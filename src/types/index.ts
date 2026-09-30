export type SearchMode = 'department' | 'budget_owner';

export interface User {
    UserID: string;
    Email: string;
    FullName: string;
    Role: string;
}

export interface Department {
    DeptID: string;
    DeptName: string;
    RouteGroup: string;
    Building?: string;
    Floor?: string | number;
    BudgetOwner?: string;
}

export interface Service {
    ServiceID: string;
    ServiceName: string;
}

export interface LogItem {
    id: string;
    timestamp: string;
    dept: string;
    desc: string;
    count: number;
    cost?: number;
    type: 'run' | 'sort' | 'ext';
    fund?: string;
    syncStatus?: 'pending' | 'syncing' | 'synced' | 'auth_required' | 'failed';
    sourceFiscalYear?: number;
    sourceType?: 'active' | 'archive';
    sourceSpreadsheetId?: string;
    /** เส้นทาง/สายส่ง (เฉพาะ run) */
    route?: string;
    /** รอบการส่ง เช่น รอบเช้า/รอบบ่าย (เฉพาะ run) */
    round?: string;
    /** จำนวนไปรษณีย์ธรรมดา (เฉพาะ sort) */
    normalCount?: number;
    /** จำนวนไปรษณีย์ลงทะเบียน (เฉพาะ sort) */
    registerCount?: number;
    /** จำนวนไปรษณีย์ส่วนตัว (เฉพาะ sort) */
    privateCount?: number;
}
