import { describe, it, expect } from 'vitest';

// Copy of backend.gs functions for local unit testing
function sanitizeInput(val: any) {
  if (typeof val === 'string') {
    const firstChar = val.charAt(0);
    if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
      return "'" + val;
    }
  }
  return val;
}

interface MockFile {
  name: string;
  createdDate: Date;
  trashed: boolean;
  getName(): string;
  getDateCreated(): Date;
  setTrashed(trashed: boolean): void;
}

function applyBackupRetention(folder: any, retentionDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const files = folder.getFiles();
  let deletedCount = 0;
  
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    
    // ตรวจสอบความปลอดภัยของชื่อไฟล์เพื่อป้องกันการลบข้อมูลสำคัญผิดพลาด (รองรับทั้งชื่อเก่าและใหม่)
    if ((name.indexOf("WUS_Track_Backup_") === 0 || name.indexOf("Dcg_Smart_Service_Backup_") === 0) && name.slice(-5) === ".xlsx") {
      if (file.getDateCreated() < cutoffDate) {
        file.setTrashed(true);
        deletedCount++;
      }
    }
  }
  return deletedCount;
}

describe('backend.gs - sanitizeInput (CSV / Formula Injection Protection)', () => {
  it('should prepend a single quote to inputs starting with =', () => {
    expect(sanitizeInput('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
  });

  it('should prepend a single quote to inputs starting with +', () => {
    expect(sanitizeInput('+123')).toBe("'+123");
  });

  it('should prepend a single quote to inputs starting with -', () => {
    expect(sanitizeInput('-456')).toBe("'-456");
  });

  it('should prepend a single quote to inputs starting with @', () => {
    expect(sanitizeInput('@wu.ac.th')).toBe("'@wu.ac.th");
  });

  it('should not alter normal string inputs', () => {
    expect(sanitizeInput('normal text')).toBe('normal text');
    expect(sanitizeInput('wu@wu.ac.th')).toBe('wu@wu.ac.th'); // '@' is not at index 0
  });

  it('should not alter non-string inputs', () => {
    expect(sanitizeInput(123)).toBe(123);
    expect(sanitizeInput(true)).toBe(true);
    expect(sanitizeInput(null)).toBe(null);
  });
});

describe('backend.gs - applyBackupRetention (Retention Policy)', () => {
  it('should trash files older than 30 days that match backup pattern', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 31);

    const newDate = new Date();
    newDate.setDate(newDate.getDate() - 10);

    const filesList: MockFile[] = [
      {
        name: "WUS_Track_Backup_2026-05-01_120000.xlsx",
        createdDate: oldDate,
        trashed: false,
        getName() { return this.name; },
        getDateCreated() { return this.createdDate; },
        setTrashed(val: boolean) { this.trashed = val; }
      },
      {
        name: "Dcg_Smart_Service_Backup_2026-05-01_120000.xlsx",
        createdDate: oldDate,
        trashed: false,
        getName() { return this.name; },
        getDateCreated() { return this.createdDate; },
        setTrashed(val: boolean) { this.trashed = val; }
      },
      {
        name: "WUS_Track_Backup_2026-05-25_120000.xlsx",
        createdDate: newDate,
        trashed: false,
        getName() { return this.name; },
        getDateCreated() { return this.createdDate; },
        setTrashed(val: boolean) { this.trashed = val; }
      },
      {
        name: "Important_File.xlsx", // Non-matching name pattern
        createdDate: oldDate,
        trashed: false,
        getName() { return this.name; },
        getDateCreated() { return this.createdDate; },
        setTrashed(val: boolean) { this.trashed = val; }
      }
    ];

    let index = 0;
    const folderMock = {
      getFiles: () => ({
        hasNext: () => index < filesList.length,
        next: () => filesList[index++]
      })
    };

    const deleted = applyBackupRetention(folderMock);

    expect(deleted).toBe(2);
    expect(filesList[0].trashed).toBe(true);  // Older than 30 days, old pattern -> trashed
    expect(filesList[1].trashed).toBe(true);  // Older than 30 days, new pattern -> trashed
    expect(filesList[2].trashed).toBe(false); // Newer than 30 days -> preserved
    expect(filesList[3].trashed).toBe(false); // Older than 30 days, but non-matching name -> preserved
  });
});
