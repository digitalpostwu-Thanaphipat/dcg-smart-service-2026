import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Load backend.gs content dynamically from root
const backendGsPath = path.resolve(process.cwd(), 'backend.gs');
const backendGsContent = fs.readFileSync(backendGsPath, 'utf8');

// Helper to isolate sanitizeInput function by extracting balanced braces
function getSanitizeInput() {
  const fnStart = backendGsContent.indexOf('function sanitizeInput(');
  if (fnStart === -1) throw new Error("Could not find sanitizeInput in backend.gs");
  
  // Find the opening brace of the function
  const bodyStart = backendGsContent.indexOf('{', fnStart);
  if (bodyStart === -1) throw new Error("Could not find opening brace for sanitizeInput");
  
  // Count braces to find matching closing brace
  let depth = 0;
  let bodyEnd = -1;
  for (let i = bodyStart; i < backendGsContent.length; i++) {
    if (backendGsContent[i] === '{') depth++;
    else if (backendGsContent[i] === '}') depth--;
    if (depth === 0) {
      bodyEnd = i;
      break;
    }
  }
  if (bodyEnd === -1) throw new Error("Could not find closing brace for sanitizeInput");
  
  const fnBody = backendGsContent.substring(bodyStart + 1, bodyEnd);
  const evalFn = new Function('val', fnBody);
  return evalFn as (val: any) => any;
}

// Helper to evaluate backend.gs functions inside a mocked Google Apps Script context
function createMockedBackend(mocks: Record<string, any>) {
  const scriptMockDefinition = Object.keys(mocks)
    .map(key => `var ${key} = mocks.${key};`)
    .join('\n');
  
  const code = `
    const mocks = arguments[0];
    ${scriptMockDefinition}
    
    // Evaluate backend.gs
    ${backendGsContent}
    
    return {
      handleFeedback,
      runAutoBackup,
      setupDailyBackupTrigger,
      applyBackupRetention,
      getSchemaAudit,
      ensureMasterUsersHeadersSync,
      runArchiveRollover,
      searchLogsCrossYear,
      publicSearchCrossYear,
      logStaffReportEvent,
      verifyOTP,
      verifySelfServiceOTP,
      requestSelfServiceOTP,
      hashToken,
      verifySessionToken,
      doPost,
      deleteLog,
    };
  `;
  
  try {
    const evalFn = new Function(code);
    return evalFn(mocks);
  } catch (err) {
    console.error("Evaluation failed", err);
    throw err;
  }
}

describe('backend.gs - sanitizeInput (CSV / Formula Injection prevention)', () => {
  const sanitizeInput = getSanitizeInput();

  it('should prepend a single quote to strings starting with "="', () => {
    expect(sanitizeInput('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
  });

  it('should prepend a single quote to strings starting with "+"', () => {
    expect(sanitizeInput('+123')).toBe("'+123");
  });

  it('should prepend a single quote to strings starting with "-"', () => {
    expect(sanitizeInput('-ABC')).toBe("'-ABC");
  });

  it('should prepend a single quote to strings starting with "@"', () => {
    expect(sanitizeInput('@test')).toBe("'@test");
  });

  it('should not alter normal strings', () => {
    expect(sanitizeInput('WU.ac.th')).toBe('WU.ac.th');
    expect(sanitizeInput('feedback details')).toBe('feedback details');
  });

  it('should not alter non-string types', () => {
    expect(sanitizeInput(123)).toBe(123);
    expect(sanitizeInput(true)).toBe(true);
    expect(sanitizeInput(null)).toBe(null);
  });
});

describe('backend.gs - session expiry policy', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function createSheet(headers: string[], rows: any[][] = []) {
    const values = [headers, ...rows];
    const appendRow = vi.fn((row) => values.push(row));
    return {
      values,
      appendRow,
      getDataRange: vi.fn(() => ({ getValues: () => values })),
      getLastRow: vi.fn(() => values.length),
      getLastColumn: vi.fn(() => headers.length),
      getRange: vi.fn((row: number, col: number) => ({
        getValues: () => [headers],
        getValue: () => values[row - 1]?.[col - 1] ?? '',
        setValue: vi.fn((value) => {
          values[row - 1] = values[row - 1] || [];
          values[row - 1][col - 1] = value;
        }),
      })),
    };
  }

  it('issues staff sessions through Friday end of day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T09:30:00+07:00'));

    const otpSheet = createSheet(
      ['Email', 'OTPCode', 'OTPExpiresAt', 'SessionToken', 'SessionExpiresAt', 'FailedAttempts'],
      [['staff@wu.ac.th', '123456', new Date('2026-06-10T09:45:00+07:00'), '', new Date(0), 0]],
    );
    const userSheet = createSheet(
      ['UserID', 'Email', 'FullName', 'Role', 'Status'],
      [['U001', 'staff@wu.ac.th', 'Staff User', 'staff', 'Active']],
    );
    const configSheet = createSheet(['Key', 'Value'], [['restrictWorkdays', 'true']]);
    const spreadsheet = {
      getSheetByName: vi.fn((name) => {
        if (name === 'Tx_OTPStore') return otpSheet;
        if (name === 'Master_Users') return userSheet;
        if (name === 'System_Config') return configSheet;
        return null;
      }),
    };
    const backend = createMockedBackend({
      SpreadsheetApp: { flush: vi.fn(), openById: vi.fn(() => spreadsheet), getActiveSpreadsheet: vi.fn(() => spreadsheet) },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn((key) => (key === 'SPREADSHEET_ID' ? 'mock-spreadsheet' : null)),
        })),
      },
      Utilities: {
        getUuid: vi.fn(() => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
        computeDigest: vi.fn((algorithm, value) => {
          // Simple mock hash for testing
          return [0x53, 0x48, 0x41, 0x5f, 0x32, 0x35, 0x36]; // "SHA_256" in ASCII
        }),
        DigestAlgorithm: { SHA_256: 'SHA_256' },
      },
      console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
    });

    const result = backend.verifyOTP({ email: 'staff@wu.ac.th', code: '123456' });

    expect(result.sessionToken).toBe('ST-AAAAAAAABBBBCCCC');
    const sessionExpiresAt = otpSheet.values[1][4] as Date;
    expect(sessionExpiresAt.toISOString()).toBe('2026-06-12T16:59:59.999Z');
  });

  it('issues self-service sessions through current day only', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T09:30:00+07:00'));

    const selfServiceOtpSheet = createSheet(
      ['Email', 'OTPCode', 'OTPExpiresAt', 'SessionToken', 'SessionExpiresAt', 'FailedAttempts', 'LastRequestedAt'],
      [['viewer@example.com', '654321', new Date('2026-06-10T09:45:00+07:00'), '', new Date(0), 0, new Date('2026-06-10T09:00:00+07:00')]],
    );
    const spreadsheet = {
      getSheetByName: vi.fn((name) => {
        if (name === 'Tx_SelfServiceOTPStore') return selfServiceOtpSheet;
        return null;
      }),
      insertSheet: vi.fn(),
    };
    const backend = createMockedBackend({
      SpreadsheetApp: { flush: vi.fn(), openById: vi.fn(() => spreadsheet), getActiveSpreadsheet: vi.fn(() => spreadsheet) },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn((key) => (key === 'SPREADSHEET_ID' ? 'mock-spreadsheet' : null)),
        })),
      },
      Utilities: {
        getUuid: vi.fn(() => 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'),
        computeDigest: vi.fn((algorithm, value) => {
          return [0x53, 0x48, 0x41, 0x5f, 0x32, 0x35, 0x36];
        }),
        DigestAlgorithm: { SHA_256: 'SHA_256' },
      },
      console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
    });

    const result = backend.verifySelfServiceOTP({ email: 'viewer@example.com', code: '654321' });

    expect(result.sessionToken).toBe('SS-BBBBBBBBCCCCDDDDEEEEFFFF');
    const sessionExpiresAt = selfServiceOtpSheet.values[1][4] as Date;
    expect(sessionExpiresAt.toISOString()).toBe('2026-06-10T16:59:59.999Z');
  });
});

describe('backend.gs - schema guard read-only audit', () => {
  it('blocks Master_Users self-healing writes unless schema repair is explicitly approved', () => {
    const setValue = vi.fn();
    const deleteColumn = vi.fn();
    const userSheet = {
      getLastRow: vi.fn(() => 3),
      getLastColumn: vi.fn(() => 4),
      getRange: vi.fn((row: number, col: number, numRows?: number, numCols?: number) => {
        if (row === 1 && col === 1 && numRows === 1) {
          return { getValues: () => [['UserID', '', '', 'FullName']] };
        }
        if (row === 2 && col === 2) {
          return { getValue: () => 'staff@example.com' };
        }
        if (row === 2 && col === 3) {
          return { getValues: () => [[''], ['']] };
        }
        return { getValues: () => [[]], getValue: () => '', setValue };
      }),
      deleteColumn,
    };
    const spreadsheet = {
      getSheetByName: vi.fn((name) => (name === 'Master_Users' ? userSheet : null)),
    };
    const backend = createMockedBackend({
      SpreadsheetApp: { flush: vi.fn(), openById: vi.fn(() => spreadsheet), getActiveSpreadsheet: vi.fn(() => spreadsheet) },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn((key) => (key === 'SCHEMA_REPAIR_APPROVED' ? 'false' : 'mock-spreadsheet')),
        })),
      },
      console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
    });

    const result = backend.ensureMasterUsersHeadersSync(spreadsheet);

    expect(result.status).toBe('repair_required');
    expect(result.repairs).toEqual([
      'set Master_Users!B1 to Email',
      'delete empty Master_Users column C before FullName',
    ]);
    expect(setValue).not.toHaveBeenCalled();
    expect(deleteColumn).not.toHaveBeenCalled();
  });

  it('returns a read-only schema audit report without creating or editing sheets', () => {
    const insertSheet = vi.fn();
    const selfServiceLogHeaders = [
      'Timestamp', 'Email', 'Action', 'QueryText', 'QueryMode', 'SelectedDeptName',
      'BudgetOwnerEffective', 'MatchedDeptCount', 'DateMode', 'StartDate', 'EndDate',
      'FiscalYear', 'ResultCountRun', 'ResultCountSort', 'ResultCountExt', 'ExportFormat',
      'TrackingMode', 'Status', 'UserAgent', 'ErrorCode', 'ErrorMessage',
    ];
    const selfServiceLogSheet = {
      getLastColumn: vi.fn(() => selfServiceLogHeaders.length),
      getRange: vi.fn(() => ({ getValues: () => [selfServiceLogHeaders] })),
    };
    const spreadsheet = {
      getSheetByName: vi.fn((name) => (name === 'Tx_SelfServiceLog' ? selfServiceLogSheet : null)),
      insertSheet,
    };
    const backend = createMockedBackend({
      SpreadsheetApp: { flush: vi.fn(), openById: vi.fn(() => spreadsheet), getActiveSpreadsheet: vi.fn(() => spreadsheet) },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn((key) => (key === 'SCHEMA_REPAIR_APPROVED' ? 'false' : 'mock-spreadsheet')),
        })),
      },
      console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
    });

    const result = backend.getSchemaAudit();
    const logSheet = result.sheets.find((sheet: any) => sheet.sheetName === 'Tx_SelfServiceLog');

    expect(result.mode).toBe('read_only');
    expect(logSheet.status).toBe('ok');
    expect(logSheet.headerCount).toBe(21);
    expect(insertSheet).not.toHaveBeenCalled();
  });
});

describe('backend.gs - archive rollover safety', () => {
  function createSheet(headers: string[], rows: any[][] = []) {
    const values = [headers, ...rows];
    return {
      values,
      appendRow: vi.fn((row) => values.push(row)),
      getDataRange: vi.fn(() => ({ getValues: () => values })),
      getLastRow: vi.fn(() => values.length),
      getLastColumn: vi.fn(() => values[0]?.length || 0),
      getRange: vi.fn((row: number, col: number, _numRows?: number, _numCols?: number) => ({
        getValues: () => [values[row - 1] || []],
        setValues: vi.fn((rowsToSet: any[][]) => {
          rowsToSet.forEach((rowToSet, index) => {
            values[row - 1 + index] = rowToSet;
          });
        }),
        setValue: vi.fn((value) => {
          values[row - 1] = values[row - 1] || [];
          values[row - 1][col - 1] = value;
        }),
      })),
    };
  }

  function createArchiveBackend(scriptProperties: Record<string, string> = {}) {
    const runSheet = createSheet(
      ['TxID', 'Timestamp', 'DeptName', 'Route', 'Round', 'ItemCount', 'Note', 'StaffEmail'],
      [
        ['RUN-OLD', new Date('2025-09-30T08:00:00+07:00'), 'Old Dept', 'A', 'AM', 1, '', 'staff@wu.ac.th'],
        ['RUN-ACTIVE', new Date('2025-10-01T08:00:00+07:00'), 'Active Dept', 'A', 'AM', 2, '', 'staff@wu.ac.th'],
      ],
    );
    const sortSheet = createSheet(
      ['TxID', 'Timestamp', 'DeptName', 'NormalCount', 'RegisterCount', 'PrivateCount', 'Total', 'Note', 'StaffEmail'],
      [
        ['SORT-OLD', new Date('2025-09-29T08:00:00+07:00'), 'Old Dept', 1, 1, 0, 2, '', 'staff@wu.ac.th'],
      ],
    );
    const extSheet = createSheet(
      ['TxID', 'Timestamp', 'RequestingDept', 'ServiceType', 'Cost', 'ItemCount', 'TrackingNo', 'FundSource', 'StaffEmail'],
      [
        ['EXT-ACTIVE', new Date('2025-10-02T08:00:00+07:00'), 'Active Dept', 'EMS', 10, 1, 'RL1', 'WU', 'staff@wu.ac.th'],
      ],
    );
    const archiveSheets: Record<string, any> = {};
    const archiveIndex = createSheet(['placeholder'], []);
    const selfServiceLogSheet = createSheet(
      [
        'Timestamp', 'Email', 'Action', 'QueryText', 'QueryMode', 'SelectedDeptName',
        'BudgetOwnerEffective', 'MatchedDeptCount', 'DateMode', 'StartDate', 'EndDate',
        'FiscalYear', 'ResultCountRun', 'ResultCountSort', 'ResultCountExt',
        'ExportFormat', 'TrackingMode', 'Status', 'UserAgent', 'ErrorCode', 'ErrorMessage',
      ],
      [],
    );
    const sourceSS = {
      getId: vi.fn(() => 'source-spreadsheet'),
      getSheetByName: vi.fn((name) => {
        if (name === 'Tx_InternalRun') return runSheet;
        if (name === 'Tx_InternalSort') return sortSheet;
        if (name === 'Tx_ExternalPost') return extSheet;
        if (name === 'Tx_SelfServiceLog') return selfServiceLogSheet;
        if (name === 'Archive_Index' && archiveIndex.values[0][0] !== 'placeholder') return archiveIndex;
        return null;
      }),
      insertSheet: vi.fn((name) => {
        if (name === 'Archive_Index') {
          archiveIndex.values.length = 0;
          return archiveIndex;
        }
        throw new Error(`unexpected source insert ${name}`);
      }),
    };
    const archiveSS = {
      getSheetByName: vi.fn((name) => archiveSheets[name] || null),
      insertSheet: vi.fn((name) => {
        archiveSheets[name] = createSheet([], []);
        archiveSheets[name].values.length = 0;
        return archiveSheets[name];
      }),
    };
    const backend = createMockedBackend({
      SpreadsheetApp: {
        flush: vi.fn(),
        openById: vi.fn((id) => (id === 'archive-spreadsheet' ? archiveSS : sourceSS)),
        getActiveSpreadsheet: vi.fn(() => sourceSS),
      },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn((key) => scriptProperties[key] || (key === 'SPREADSHEET_ID' ? 'source-spreadsheet' : null)),
        })),
      },
      Utilities: {
        DigestAlgorithm: { SHA_256: 'SHA_256' },
        computeDigest: vi.fn((_alg, text) => [String(text).length % 256, 7, 9]),
      },
      console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
    });

    return { backend, sourceSS, archiveSS, runSheet, sortSheet, extSheet, archiveIndex, archiveSheets, selfServiceLogSheet };
  }

  it('returns a read-only dry-run archive plan without creating Archive_Index', () => {
    const { backend, sourceSS } = createArchiveBackend();

    const plan = backend.runArchiveRollover({ mode: 'dry_run', activeFiscalYear: 2569 });

    expect(plan.mode).toBe('dry_run');
    expect(plan.activeFiscalYear).toBe(2569);
    expect(plan.totalRows).toBe(2);
    expect(plan.sheets.find((sheet: any) => sheet.sheetName === 'Tx_InternalRun').rowCount).toBe(1);
    expect(plan.sheets.find((sheet: any) => sheet.sheetName === 'Tx_InternalSort').rowCount).toBe(1);
    expect(plan.sheets.find((sheet: any) => sheet.sheetName === 'Tx_ExternalPost').rowCount).toBe(0);
    expect(sourceSS.insertSheet).not.toHaveBeenCalled();
  });

  it('blocks copy-only archive unless explicitly approved', () => {
    const { backend, archiveSS } = createArchiveBackend({
      ARCHIVE_SPREADSHEET_ID: 'archive-spreadsheet',
    });

    expect(() => backend.runArchiveRollover({ mode: 'copy_only', activeFiscalYear: 2569 }))
      .toThrow('ARCHIVE_COPY_APPROVED');
    expect(archiveSS.insertSheet).not.toHaveBeenCalled();
  });

  it('copies only old fiscal-year rows and writes Archive_Index without deleting active rows', () => {
    const { backend, archiveSheets, archiveIndex, runSheet, sortSheet, extSheet } = createArchiveBackend({
      ARCHIVE_COPY_APPROVED: 'true',
      ARCHIVE_SPREADSHEET_ID: 'archive-spreadsheet',
    });

    const result = backend.runArchiveRollover({ mode: 'copy_only', activeFiscalYear: 2569 });

    expect(result.mode).toBe('copy_only');
    expect(result.deletePerformed).toBe(false);
    expect(result.totalCopiedRows).toBe(2);
    expect(archiveSheets.Tx_InternalRun.values).toHaveLength(2);
    expect(archiveSheets.Tx_InternalRun.values[1][0]).toBe('RUN-OLD');
    expect(archiveSheets.Tx_InternalSort.values).toHaveLength(2);
    expect(archiveSheets.Tx_InternalSort.values[1][0]).toBe('SORT-OLD');
    expect(archiveSheets.Tx_ExternalPost.values).toHaveLength(1);
    expect(archiveIndex.values).toHaveLength(4);
    expect(archiveIndex.values[1][7]).toBe('copy_only');
    expect(archiveIndex.values[1][8]).toBe('copied_no_delete');
    expect(runSheet.values).toHaveLength(3);
    expect(sortSheet.values).toHaveLength(2);
    expect(extSheet.values).toHaveLength(2);
  });

  it('blocks delete mode unless delete approval flag is enabled', () => {
    const { backend } = createArchiveBackend();

    expect(() => backend.runArchiveRollover({ mode: 'delete', activeFiscalYear: 2569 }))
      .toThrow('ARCHIVE_DELETE_APPROVED');
  });

  it('routes cross-year staff reports to active and archive spreadsheets with source markers', () => {
    const { backend, sourceSS, archiveSheets, archiveIndex, selfServiceLogSheet } = createArchiveBackend();
    archiveIndex.values.length = 0;
    archiveIndex.values.push(
      ['Timestamp', 'FiscalYear', 'SourceSpreadsheetId', 'ArchiveSpreadsheetId', 'SheetName', 'RowCount', 'Checksum', 'Mode', 'Status'],
      [new Date(), 2568, 'source-spreadsheet', 'archive-spreadsheet', 'Tx_InternalRun', 1, 'x', 'copy_only', 'copied_no_delete'],
      [new Date(), 2568, 'source-spreadsheet', 'archive-spreadsheet', 'Tx_InternalSort', 1, 'x', 'copy_only', 'copied_no_delete'],
      [new Date(), 2568, 'source-spreadsheet', 'archive-spreadsheet', 'Tx_ExternalPost', 1, 'x', 'copy_only', 'copied_no_delete'],
    );
    archiveSheets.Tx_InternalRun = createSheet(
      ['TxID', 'Timestamp', 'DeptName', 'Route', 'Round', 'ItemCount', 'Note', 'StaffEmail'],
      [['RUN-ARCHIVE', new Date('2025-09-15T08:00:00+07:00'), 'Old Dept', 'A', 'AM', 9, '', 'staff@wu.ac.th']],
    );
    archiveSheets.Tx_InternalSort = createSheet(
      ['TxID', 'Timestamp', 'DeptName', 'NormalCount', 'RegisterCount', 'PrivateCount', 'Total', 'Note', 'StaffEmail'],
      [['SORT-ARCHIVE', new Date('2025-09-16T08:00:00+07:00'), 'Old Dept', 1, 1, 1, 3, '', 'staff@wu.ac.th']],
    );
    archiveSheets.Tx_ExternalPost = createSheet(
      ['TxID', 'Timestamp', 'RequestingDept', 'ServiceType', 'Cost', 'ItemCount', 'TrackingNo', 'FundSource', 'StaffEmail'],
      [['EXT-ARCHIVE', new Date('2025-09-17T08:00:00+07:00'), 'Old Dept', 'EMS', 20, 2, 'RL2', 'WU', 'staff@wu.ac.th']],
    );

    const result = backend.searchLogsCrossYear({
      filters: { startDate: '2025-09-01', endDate: '2025-10-05', dateMode: 'custom' },
      email: 'staff@wu.ac.th',
    }, { email: 'staff@wu.ac.th' });

    expect(result.meta.archiveUsed).toBe(true);
    expect(result.meta.fiscalYears).toEqual([2568, 2569]);
    expect(result.run.map((row: any) => row.TxID).sort()).toEqual(['RUN-ACTIVE', 'RUN-ARCHIVE']);
    expect(result.sort.map((row: any) => row.TxID)).toEqual(['SORT-ARCHIVE']);
    expect(result.ext.map((row: any) => row.TxID).sort()).toEqual(['EXT-ACTIVE', 'EXT-ARCHIVE']);
    expect(result.run.find((row: any) => row.TxID === 'RUN-ARCHIVE').SourceType).toBe('archive');
    expect(result.run.find((row: any) => row.TxID === 'RUN-ACTIVE').SourceType).toBe('active');
    expect(selfServiceLogSheet.values).toHaveLength(2);
    expect(selfServiceLogSheet.values[1][1]).toBe('staff@wu.ac.th');
    expect(selfServiceLogSheet.values[1][2]).toBe('staff_report_search');
    expect(selfServiceLogSheet.values[1][16]).toBe('archive_report');
    expect(sourceSS.insertSheet).not.toHaveBeenCalled();
    expect(archiveSheets.Tx_InternalRun.appendRow).not.toHaveBeenCalled();
  });

  it('routes self-service cross-year search to archive in read/report mode only', () => {
    const { backend, sourceSS, archiveSheets, archiveIndex } = createArchiveBackend();
    archiveIndex.values.length = 0;
    archiveIndex.values.push(
      ['Timestamp', 'FiscalYear', 'SourceSpreadsheetId', 'ArchiveSpreadsheetId', 'SheetName', 'RowCount', 'Checksum', 'Mode', 'Status'],
      [new Date(), 2568, 'source-spreadsheet', 'archive-spreadsheet', 'Tx_InternalRun', 1, 'x', 'copy_only', 'copied_no_delete'],
    );
    archiveSheets.Tx_InternalRun = createSheet(
      ['TxID', 'Timestamp', 'DeptName', 'Route', 'Round', 'ItemCount', 'Note', 'StaffEmail'],
      [['RUN-ARCHIVE', new Date('2025-09-15T08:00:00+07:00'), 'Old Dept', 'A', 'AM', 9, '', 'staff@wu.ac.th']],
    );
    archiveSheets.Tx_InternalSort = createSheet(
      ['TxID', 'Timestamp', 'DeptName', 'NormalCount', 'RegisterCount', 'PrivateCount', 'Total', 'Note', 'StaffEmail'],
      [],
    );
    archiveSheets.Tx_ExternalPost = createSheet(
      ['TxID', 'Timestamp', 'RequestingDept', 'ServiceType', 'Cost', 'ItemCount', 'TrackingNo', 'FundSource', 'StaffEmail'],
      [],
    );

    const result = backend.publicSearchCrossYear({
      deptName: 'Old Dept',
      startDate: '2025-09-01',
      endDate: '2025-09-30',
    });

    expect(result.meta.archiveUsed).toBe(true);
    expect(result.run).toHaveLength(1);
    expect(result.run[0].sourceType).toBe('archive');
    expect(result.run[0].sourceFiscalYear).toBe(2568);
    expect(sourceSS.insertSheet).not.toHaveBeenCalled();
    expect(archiveSheets.Tx_InternalRun.appendRow).not.toHaveBeenCalled();
  });
});

describe('backend.gs - handleFeedback (Milestone 2 Validation & Line Notification)', () => {
  let mockSheet: any;
  let mockSpreadsheet: any;
  let mockLock: any;
  let lineNotificationsSent: string[];
  let scriptProperties: Record<string, string>;
  let handleFeedback: any;

  beforeEach(() => {
    lineNotificationsSent = [];
    scriptProperties = {
      LINE_NOTIFY_TOKEN: "mock-line-token-789",
      SPREADSHEET_ID: "mock-spreadsheet-123"
    };

    mockSheet = {
      appendRow: vi.fn(),
      getLastRow: vi.fn(() => 1),
      getRange: vi.fn(() => ({
        setNumberFormat: vi.fn()
      })),
    };

    mockSpreadsheet = {
      getSheetByName: vi.fn((name) => {
        if (name === "Feedback_Reports") return mockSheet;
        return null;
      }),
      insertSheet: vi.fn(() => mockSheet),
    };

    mockLock = {
      waitLock: vi.fn(),
      releaseLock: vi.fn(),
    };

    const mocks = {
      SpreadsheetApp: {
        openById: vi.fn(() => mockSpreadsheet),
        getActiveSpreadsheet: vi.fn(() => mockSpreadsheet),
        flush: vi.fn(),
      },
      LockService: {
        getScriptLock: vi.fn(() => mockLock),
      },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn((key) => scriptProperties[key] || null),
          setProperty: vi.fn((key, val) => { scriptProperties[key] = val; })
        }))
      },
      UrlFetchApp: {
        fetch: vi.fn((url, options) => {
          if (url === "https://notify-api.line.me/api/notify") {
            lineNotificationsSent.push(options.payload.message);
          }
          return {
            getResponseCode: () => 200,
            getContentText: () => "OK"
          };
        })
      },
      Utilities: {
        formatDate: vi.fn((date, tz, format) => "2026-06-04 12:00:00")
      },
      console: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      Logger: {
        log: vi.fn()
      }
    };

    const backend = createMockedBackend(mocks);
    handleFeedback = backend.handleFeedback;
  });

  it('should successfully save feedback and not trigger LINE Notify for Low severity', () => {
    const payload = {
      type: "Suggestion",
      severity: "Low",
      description: "This is a low severity feedback suggestion.",
      staffEmail: "staff@wu.ac.th"
    };

    const result = handleFeedback(payload);

    expect(result).toEqual({ message: "บันทึกข้อเสนอแนะเรียบร้อยแล้ว" });
    expect(mockSheet.appendRow).toHaveBeenCalled();
    expect(lineNotificationsSent.length).toBe(0);
  });

  it('should successfully save feedback and trigger LINE Notify for High severity', () => {
    const payload = {
      type: "Bug",
      severity: "High",
      description: "This is a high severity bug.",
      staffEmail: "staff@wu.ac.th"
    };

    const result = handleFeedback(payload);

    expect(result).toEqual({ message: "บันทึกข้อเสนอแนะเรียบร้อยแล้ว" });
    expect(mockSheet.appendRow).toHaveBeenCalled();
    expect(lineNotificationsSent.length).toBe(1);
    expect(lineNotificationsSent[0]).toContain("แจ้งเตือนข้อเสนอแนะเร่งด่วน (High)");
  });
});

describe('backend.gs - Auto-Backup Engine (Milestone 3)', () => {
  let mockSourceSS: any;
  let mockTempSS: any;
  let mockTempSheets: any[];
  let mockBackupFolder: any;
  let driveFiles: any[];
  let projectTriggers: any[];
  let deletedTriggers: any[];
  let mockBlob: any;
  let lineNotificationsSent: string[];
  let scriptProperties: Record<string, string>;

  let runAutoBackup: any;
  let setupDailyBackupTrigger: any;
  let applyBackupRetention: any;

  beforeEach(() => {
    lineNotificationsSent = [];
    scriptProperties = {
      SPREADSHEET_ID: "mock-spreadsheet-123"
    };

    // Mock sheets in source spreadsheet
    mockSourceSS = {
      getSheetByName: vi.fn((name) => {
        if (["Tx_InternalRun", "Tx_InternalSort", "Tx_ExternalPost"].includes(name)) {
          return {
            copyTo: vi.fn((targetSS) => {
              mockTempSheets.push({ name });
              return { setName: vi.fn() };
            })
          };
        }
        return null;
      })
    };

    mockTempSheets = [{ name: "Sheet1" }]; // starts with default sheet
    mockTempSS = {
      getId: () => "mock-temp-ss-999",
      getSheetByName: vi.fn((name) => mockTempSheets.find(s => s.name === name) || null),
      getSheets: () => mockTempSheets,
      deleteSheet: vi.fn((sheet) => {
        mockTempSheets = mockTempSheets.filter(s => s !== sheet);
      })
    };

    mockBlob = {
      setName: vi.fn().mockReturnThis()
    };

    driveFiles = [];
    mockBackupFolder = {
      getId: () => "mock-backup-folder-888",
      createFile: vi.fn((blob) => {
        const file = {
          getName: () => blob.name || "WUS_Track_Backup_mock.xlsx",
          getDateCreated: () => new Date(),
          setTrashed: vi.fn()
        };
        driveFiles.push(file);
        return file;
      }),
      getFiles: () => {
        let index = 0;
        return {
          hasNext: () => index < driveFiles.length,
          next: () => driveFiles[index++]
        };
      }
    };

    projectTriggers = [
      {
        getHandlerFunction: () => "runAutoBackup",
        getUniqueId: () => "trigger-1"
      },
      {
        getHandlerFunction: () => "someOtherFunction",
        getUniqueId: () => "trigger-2"
      }
    ];
    deletedTriggers = [];

    const triggerBuilder = {
      timeBased: vi.fn().mockReturnThis(),
      everyDays: vi.fn().mockReturnThis(),
      atHour: vi.fn().mockReturnThis(),
      create: vi.fn(() => {
        const newTrigger = { getHandlerFunction: () => "runAutoBackup" };
        projectTriggers.push(newTrigger);
        return newTrigger;
      })
    };

    const mocks = {
      SpreadsheetApp: {
        openById: vi.fn(() => mockSourceSS),
        getActiveSpreadsheet: vi.fn(() => mockSourceSS),
        create: vi.fn(() => mockTempSS),
        flush: vi.fn()
      },
      DriveApp: {
        getFolderById: vi.fn(() => mockBackupFolder),
        getFoldersByName: vi.fn(() => ({
          hasNext: () => true,
          next: () => mockBackupFolder
        })),
        getFileById: vi.fn((id) => {
          if (id === "mock-temp-ss-999") {
            return { setTrashed: vi.fn() };
          }
          throw new Error("File not found");
        })
      },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn((key) => scriptProperties[key] || null),
          setProperty: vi.fn((key, val) => { scriptProperties[key] = val; })
        }))
      },
      UrlFetchApp: {
        fetch: vi.fn((url, options) => {
          if (url.includes("/export?format=xlsx")) {
            return {
              getResponseCode: () => 200,
              getBlob: () => mockBlob
            };
          }
          if (url === "https://notify-api.line.me/api/notify") {
            lineNotificationsSent.push(options.payload.message);
          }
          return {
            getResponseCode: () => 200,
            getContentText: () => "OK"
          };
        })
      },
      Utilities: {
        formatDate: vi.fn(() => "2026-06-04_120000")
      },
      ScriptApp: {
        getOAuthToken: () => "mock-oauth-token",
        getProjectTriggers: () => projectTriggers,
        deleteTrigger: vi.fn((trigger) => {
          deletedTriggers.push(trigger);
          projectTriggers = projectTriggers.filter(t => t !== trigger);
        }),
        newTrigger: vi.fn(() => triggerBuilder)
      },
      console: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      Logger: {
        log: vi.fn()
      }
    };

    const backend = createMockedBackend(mocks);
    runAutoBackup = backend.runAutoBackup;
    setupDailyBackupTrigger = backend.setupDailyBackupTrigger;
    applyBackupRetention = backend.applyBackupRetention;
  });

  it('should runAutoBackup correctly, copy sheets, delete default sheet, fetch xlsx, and save to Drive', () => {
    runAutoBackup();

    // Verify copying of sheets
    expect(mockSourceSS.getSheetByName).toHaveBeenCalledWith("Tx_InternalRun");
    expect(mockSourceSS.getSheetByName).toHaveBeenCalledWith("Tx_InternalSort");
    expect(mockSourceSS.getSheetByName).toHaveBeenCalledWith("Tx_ExternalPost");

    // Verify copyTo was called and default sheet was deleted
    expect(mockTempSS.deleteSheet).toHaveBeenCalled();

    // Verify it fetched the xlsx format
    expect(mockBackupFolder.createFile).toHaveBeenCalled();
  });

  it('should setupDailyBackupTrigger without duplicates', () => {
    setupDailyBackupTrigger();

    // Verify that existing triggers for runAutoBackup were deleted
    const deletedAutoBackupTriggers = deletedTriggers.filter(t => t.getHandlerFunction() === "runAutoBackup");
    expect(deletedAutoBackupTriggers.length).toBe(1);

    // Verify that a new trigger was created
    const currentAutoBackupTriggers = projectTriggers.filter(t => t.getHandlerFunction() === "runAutoBackup");
    expect(currentAutoBackupTriggers.length).toBe(1);
  });

  it('should applyBackupRetention and delete backup files older than 30 days', () => {
    const freshFile = {
      getName: () => "WUS_Track_Backup_2026-06-04.xlsx",
      getDateCreated: () => new Date(), // Today
      setTrashed: vi.fn()
    };

    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    
    const staleFile = {
      getName: () => "WUS_Track_Backup_2026-05-01.xlsx",
      getDateCreated: () => thirtyOneDaysAgo, // 31 days ago
      setTrashed: vi.fn()
    };

    const staleFileNewName = {
      getName: () => "Dcg_Smart_Service_Backup_2026-05-01.xlsx",
      getDateCreated: () => thirtyOneDaysAgo, // 31 days ago
      setTrashed: vi.fn()
    };

    const unrelatedFile = {
      getName: () => "Other_File.txt",
      getDateCreated: () => thirtyOneDaysAgo,
      setTrashed: vi.fn()
    };

    driveFiles.push(freshFile, staleFile, staleFileNewName, unrelatedFile);

    applyBackupRetention(mockBackupFolder);

    // Verify stale files were trashed
    expect(staleFile.setTrashed).toHaveBeenCalledWith(true);
    expect(staleFileNewName.setTrashed).toHaveBeenCalledWith(true);
    expect(freshFile.setTrashed).not.toHaveBeenCalled();
    expect(unrelatedFile.setTrashed).not.toHaveBeenCalled();
  });
});

describe('backend.gs - security: hashToken', () => {
  it('hashToken should return consistent hex digest and use SHA_256', () => {
    const computeDigestSpy = vi.fn((algorithm, value) => {
      return [0xAB, 0xCD, 0xEF, 0x12, 0x34, 0x56, 0x78, 0x90];
    });

    const backend = createMockedBackend({
      Utilities: {
        computeDigest: computeDigestSpy,
        DigestAlgorithm: { SHA_256: 'SHA_256' },
      },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn(() => null),
        })),
      },
      SpreadsheetApp: {
        getActiveSpreadsheet: vi.fn(() => ({
          getSheetByName: vi.fn(() => null),
        })),
      },
      console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
    });

    const hash = backend.hashToken('test-token');
    expect(hash).toBe('abcdef1234567890');
    // Verify SHA_256 algorithm was used
    expect(computeDigestSpy).toHaveBeenCalledWith('SHA_256', 'test-token');
  });
});

describe('backend.gs - security: RBAC log-only', () => {
  it('verifySessionToken should return role from Master_Users (non-admin)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T10:00:00+07:00'));

    const createSimpleSheet = (headers: string[], rows: any[][] = []) => ({
      getDataRange: () => ({
        getValues: () => [headers, ...rows],
      }),
      getSheetName: () => 'MockSheet',
    });

    // Staff user (non-admin) with valid session
    const otpSheet = createSimpleSheet(
      ['Email', 'OTPCode', 'OTPExpiresAt', 'SessionToken', 'SessionTokenHash', 'SessionExpiresAt', 'FailedAttempts', 'LastRequestedAt'],
      [['staff@wu.ac.th', '', new Date(0), 'ST-TESTTOKEN', 'hash123', new Date('2026-06-12T16:59:59'), 0, new Date()]],
    );
    const usersSheet = createSimpleSheet(
      ['UserID', 'Email', 'FullName', 'Role', 'Status'],
      [['U001', 'staff@wu.ac.th', 'Staff User', 'Staff', 'Active']],
    );

    const spreadsheet = {
      getSheetByName: vi.fn((name) => {
        if (name === 'Tx_OTPStore') return otpSheet;
        if (name === 'Master_Users') return usersSheet;
        return null;
      }),
    };

    const backend = createMockedBackend({
      SpreadsheetApp: { flush: vi.fn(), openById: vi.fn(() => spreadsheet), getActiveSpreadsheet: vi.fn(() => spreadsheet) },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn((key) => (key === 'SPREADSHEET_ID' ? 'mock-spreadsheet' : null)),
        })),
      },
      Utilities: {
        getUuid: vi.fn(() => 'test-uuid'),
        computeDigest: vi.fn(() => [0x01, 0x02]),
        DigestAlgorithm: { SHA_256: 'SHA_256' },
      },
      console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
    });

    // verifySessionToken returns role
    const result = backend.verifySessionToken('ST-TESTTOKEN');
    expect(result.email).toBe('staff@wu.ac.th');
    expect(result.role).toBe('Staff');

    // RBAC check: non-admin role triggers warning in doPost
    // (doPost requires full GAS event mock, tested via integration/manual)
    // verifySessionToken correctly provides role for RBAC decision
  });

  it('verifySessionToken should return Admin role for admin user', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T10:00:00+07:00'));

    const createSimpleSheet = (headers: string[], rows: any[][] = []) => ({
      getDataRange: () => ({
        getValues: () => [headers, ...rows],
      }),
      getSheetName: () => 'MockSheet',
    });

    // Admin user with valid session
    const otpSheet = createSimpleSheet(
      ['Email', 'OTPCode', 'OTPExpiresAt', 'SessionToken', 'SessionTokenHash', 'SessionExpiresAt', 'FailedAttempts', 'LastRequestedAt'],
      [['admin@wu.ac.th', '', new Date(0), 'ST-ADMINTOKEN', 'hash456', new Date('2026-06-12T16:59:59'), 0, new Date()]],
    );
    const usersSheet = createSimpleSheet(
      ['UserID', 'Email', 'FullName', 'Role', 'Status'],
      [['U002', 'admin@wu.ac.th', 'Admin User', 'Admin', 'Active']],
    );

    const spreadsheet = {
      getSheetByName: vi.fn((name) => {
        if (name === 'Tx_OTPStore') return otpSheet;
        if (name === 'Master_Users') return usersSheet;
        return null;
      }),
    };

    const backend = createMockedBackend({
      SpreadsheetApp: { flush: vi.fn(), openById: vi.fn(() => spreadsheet), getActiveSpreadsheet: vi.fn(() => spreadsheet) },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn((key) => (key === 'SPREADSHEET_ID' ? 'mock-spreadsheet' : null)),
        })),
      },
      Utilities: {
        getUuid: vi.fn(() => 'test-uuid'),
        computeDigest: vi.fn(() => [0x01, 0x02]),
        DigestAlgorithm: { SHA_256: 'SHA_256' },
      },
      console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
    });

    // verifySessionToken returns Admin role
    const result = backend.verifySessionToken('ST-ADMINTOKEN');
    expect(result.email).toBe('admin@wu.ac.th');
    expect(result.role).toBe('Admin');
  });

  it('verifySessionToken should normalize email when looking up role', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T10:00:00+07:00'));

    const createSimpleSheet = (headers: string[], rows: any[][] = []) => ({
      getDataRange: () => ({
        getValues: () => [headers, ...rows],
      }),
      getSheetName: () => 'MockSheet',
    });

    // User with email that has spaces/case differences
    const otpSheet = createSimpleSheet(
      ['Email', 'OTPCode', 'OTPExpiresAt', 'SessionToken', 'SessionTokenHash', 'SessionExpiresAt', 'FailedAttempts', 'LastRequestedAt'],
      [['  Staff@WU.AC.TH  ', '', new Date(0), 'ST-NORMTOKEN', 'hash789', new Date('2026-06-12T16:59:59'), 0, new Date()]],
    );
    const usersSheet = createSimpleSheet(
      ['UserID', 'Email', 'FullName', 'Role', 'Status'],
      [['U003', 'staff@wu.ac.th', 'Staff User', 'Staff', 'Active']],
    );

    const spreadsheet = {
      getSheetByName: vi.fn((name) => {
        if (name === 'Tx_OTPStore') return otpSheet;
        if (name === 'Master_Users') return usersSheet;
        return null;
      }),
    };

    const backend = createMockedBackend({
      SpreadsheetApp: { flush: vi.fn(), openById: vi.fn(() => spreadsheet), getActiveSpreadsheet: vi.fn(() => spreadsheet) },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn((key) => (key === 'SPREADSHEET_ID' ? 'mock-spreadsheet' : null)),
        })),
      },
      Utilities: {
        getUuid: vi.fn(() => 'test-uuid'),
        computeDigest: vi.fn(() => [0x01, 0x02]),
        DigestAlgorithm: { SHA_256: 'SHA_256' },
      },
      console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
    });

    // Should still find role despite email case/space differences
    const result = backend.verifySessionToken('ST-NORMTOKEN');
    expect(result.email).toBe('  Staff@WU.AC.TH  ');
    expect(result.role).toBe('Staff'); // Found via normalized email lookup
  });
});

describe('backend.gs - security: mock token removal', () => {
  it('verifySessionToken should reject mock-token-123', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T10:00:00+07:00'));

    // Create minimal mock sheets
    const createSimpleSheet = (headers: string[], rows: any[][] = []) => ({
      getDataRange: () => ({
        getValues: () => [headers, ...rows],
      }),
      getSheetName: () => 'MockSheet',
    });

    const otpSheet = createSimpleSheet(
      ['Email', 'OTPCode', 'OTPExpiresAt', 'SessionToken', 'SessionTokenHash', 'SessionExpiresAt', 'FailedAttempts', 'LastRequestedAt'],
      [],
    );
    const usersSheet = createSimpleSheet(
      ['UserID', 'Email', 'FullName', 'Role', 'Status'],
      [],
    );

    const spreadsheet = {
      getSheetByName: vi.fn((name) => {
        if (name === 'Tx_OTPStore') return otpSheet;
        if (name === 'Master_Users') return usersSheet;
        return null;
      }),
    };

    const backend = createMockedBackend({
      SpreadsheetApp: { flush: vi.fn(), openById: vi.fn(() => spreadsheet), getActiveSpreadsheet: vi.fn(() => spreadsheet) },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn(() => null),
        })),
      },
      Utilities: {
        computeDigest: vi.fn(() => [0x01]),
        DigestAlgorithm: { SHA_256: 'SHA_256' },
      },
      console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
    });

    // mock-token-123 should be rejected (no bypass)
    expect(() => backend.verifySessionToken('mock-token-123')).toThrow();
  });
});

describe('backend.gs - deleteLog batch deletion', () => {
  it('should delete single row and call deleteRows once', () => {
    const deleteRowsSpy = vi.fn();
    const deleteRowSpy = vi.fn();
    const flushSpy = vi.fn();

    const txSheet = {
      getDataRange: () => ({
        getValues: () => [
          ['TxID', 'Timestamp', 'DeptName'],
          ['TX-001', '2026-06-10 09:00:00', 'แผนกทดสอบ'],
          ['TX-002', '2026-06-10 10:00:00', 'แผนกอื่น'],
        ],
      }),
      deleteRows: deleteRowsSpy,
      deleteRow: deleteRowSpy,
    };

    const spreadsheet = {
      getSheetByName: vi.fn((name) => {
        if (name === 'Tx_InternalRun') return txSheet;
        return null;
      }),
    };

    const backend = createMockedBackend({
      SpreadsheetApp: { flush: flushSpy, openById: vi.fn(() => spreadsheet), getActiveSpreadsheet: vi.fn(() => spreadsheet) },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn(() => null),
        })),
      },
      LockService: { getScriptLock: vi.fn(() => ({ waitLock: vi.fn(), releaseLock: vi.fn() })), tryLock: vi.fn(() => true) },
      console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
    });

    const result = backend.deleteLog({ id: 'TX-001', type: 'run' });

    expect(result.deletedCount).toBe(1);
    expect(deleteRowsSpy).toHaveBeenCalledWith(2, 1); // row 2, count 1
    expect(deleteRowSpy).not.toHaveBeenCalled(); // ไม่ควรใช้ deleteRow ทีละแถว
  });

  it('should delete multiple contiguous rows with single deleteRows call', () => {
    const deleteRowsSpy = vi.fn();
    const deleteRowSpy = vi.fn();

    const txSheet = {
      getDataRange: () => ({
        getValues: () => [
          ['TxID', 'Timestamp', 'DeptName'],
          ['TX-001', '2026-06-10 09:00:00', 'แผนกทดสอบ'],
          ['TX-001', '2026-06-10 10:00:00', 'แผนกทดสอบ'],
          ['TX-001', '2026-06-10 11:00:00', 'แผนกทดสอบ'],
          ['TX-002', '2026-06-10 12:00:00', 'แผนกอื่น'],
        ],
      }),
      deleteRows: deleteRowsSpy,
      deleteRow: deleteRowSpy,
    };

    const spreadsheet = {
      getSheetByName: vi.fn((name) => {
        if (name === 'Tx_InternalRun') return txSheet;
        return null;
      }),
    };

    const backend = createMockedBackend({
      SpreadsheetApp: { flush: vi.fn(), openById: vi.fn(() => spreadsheet), getActiveSpreadsheet: vi.fn(() => spreadsheet) },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn(() => null),
        })),
      },
      LockService: { getScriptLock: vi.fn(() => ({ waitLock: vi.fn(), releaseLock: vi.fn() })), tryLock: vi.fn(() => true) },
      console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
    });

    const result = backend.deleteLog({ id: 'TX-001', type: 'run' });

    expect(result.deletedCount).toBe(3);
    expect(deleteRowsSpy).toHaveBeenCalledTimes(1); // เรียก deleteRows 1 ครั้ง
    expect(deleteRowsSpy).toHaveBeenCalledWith(2, 3); // row 2, count 3
    expect(deleteRowSpy).not.toHaveBeenCalled();
  });

  it('should return deletedCount 0 when id not found', () => {
    const deleteRowsSpy = vi.fn();

    const txSheet = {
      getDataRange: () => ({
        getValues: () => [
          ['TxID', 'Timestamp', 'DeptName'],
          ['TX-001', '2026-06-10 09:00:00', 'แผนกทดสอบ'],
        ],
      }),
      deleteRows: deleteRowsSpy,
    };

    const spreadsheet = {
      getSheetByName: vi.fn((name) => {
        if (name === 'Tx_InternalRun') return txSheet;
        return null;
      }),
    };

    const backend = createMockedBackend({
      SpreadsheetApp: { flush: vi.fn(), openById: vi.fn(() => spreadsheet), getActiveSpreadsheet: vi.fn(() => spreadsheet) },
      PropertiesService: {
        getScriptProperties: vi.fn(() => ({
          getProperty: vi.fn(() => null),
        })),
      },
      LockService: { getScriptLock: vi.fn(() => ({ waitLock: vi.fn(), releaseLock: vi.fn() })), tryLock: vi.fn(() => true) },
      console: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
    });

    const result = backend.deleteLog({ id: 'TX-999', type: 'run' });

    expect(result.deletedCount).toBe(0);
    expect(deleteRowsSpy).not.toHaveBeenCalled();
  });
});
