import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    
    return { handleFeedback, runAutoBackup, setupDailyBackupTrigger, applyBackupRetention };
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
