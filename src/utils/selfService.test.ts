import { describe, expect, it } from 'vitest';
import {
  buildSelfServiceExportFileName,
  buildSelfServiceExportSheets,
  buildSelfServiceErrorLogPayload,
  buildSelfServicePrintHtml,
  maskTrackingNumber,
  resolveSelfServiceSelection,
  summarizePublicExtByFund,
} from './selfService';
import { Department } from '../types';

const departments: Department[] = [
  {
    DeptID: 'D001',
    DeptName: 'หน่วยงานแม่',
    RouteGroup: 'สาย A',
    Building: 'อาคาร A',
    Floor: '1',
    BudgetOwner: 'หน่วยงานแม่',
  },
  {
    DeptID: 'D002',
    DeptName: 'หน่วยงานย่อย',
    RouteGroup: 'สาย A',
    Building: 'อาคาร B',
    Floor: '2',
    BudgetOwner: 'หน่วยงานแม่',
  },
  {
    DeptID: 'D003',
    DeptName: 'หน่วยงานอื่น',
    RouteGroup: 'สาย B',
    Building: 'อาคาร C',
    Floor: '3',
  },
];

describe('self-service utilities', () => {
  it('resolves department mode to exactly one selected department', () => {
    expect(resolveSelfServiceSelection(departments, 'หน่วยงานย่อย (อาคาร B ชั้น 2)', 'department')).toEqual({
      queryMode: 'department',
      deptName: 'หน่วยงานย่อย',
      budgetOwner: 'หน่วยงานแม่',
      matchedDepartments: ['หน่วยงานย่อย'],
    });
  });

  it('resolves budget owner mode to the parent and all child departments', () => {
    expect(resolveSelfServiceSelection(departments, 'หน่วยงานย่อย', 'budget_owner')).toEqual({
      queryMode: 'budget_owner',
      deptName: 'หน่วยงานย่อย',
      budgetOwner: 'หน่วยงานแม่',
      matchedDepartments: ['หน่วยงานแม่', 'หน่วยงานย่อย'],
    });
  });

  it('masks tracking numbers while preserving useful recognition characters', () => {
    expect(maskTrackingNumber('RL123456789TH')).toBe('RL123***89TH');
    expect(maskTrackingNumber('ABC123')).toBe('AB***');
    expect(maskTrackingNumber('')).toBe('-');
  });

  it('summarizes external post data into the three official fund groups', () => {
    const summary = summarizePublicExtByFund([
      { fund: 'งบประมาณส่วนกลาง', count: 2, cost: 100 },
      { fund: 'งบประมาณโครงการ', count: 3, cost: 150 },
      { fund: 'งบวิสาหกิจ', count: 1, cost: 80 },
    ]);

    expect(Object.keys(summary)).toEqual([
      'งบประมาณมหาวิทยาลัย',
      'งบประมาณโครงการ',
      'งบประมาณวิสาหกิจ',
    ]);
    expect(summary['งบประมาณมหาวิทยาลัย']).toEqual({ items: 2, cost: 100 });
    expect(summary['งบประมาณโครงการ']).toEqual({ items: 3, cost: 150 });
    expect(summary['งบประมาณวิสาหกิจ']).toEqual({ items: 1, cost: 80 });
  });
  it('builds a sanitized browser error log payload for self-service monitoring', () => {
    const payload = buildSelfServiceErrorLogPayload({
      email: ' Viewer@Example.COM ',
      queryText: `  ${'q'.repeat(130)}  `,
      queryMode: 'budget_owner',
      selectedDeptName: 'หน่วยงานย่อย',
      budgetOwner: 'หน่วยงานแม่',
      matchedDeptCount: 2,
      dateMode: 'fiscal_year',
      startDate: '2025-10-01',
      endDate: '2026-09-30',
      fiscalYear: '2569',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0 Safari/537.36',
      errorCode: 'SEARCH_FAILED',
      errorMessage: ` ${'x'.repeat(220)} `,
    });

    expect(payload).toMatchObject({
      email: 'viewer@example.com',
      action: 'self_service_error',
      queryMode: 'budget_owner',
      selectedDeptName: 'หน่วยงานย่อย',
      budgetOwnerEffective: 'หน่วยงานแม่',
      matchedDeptCount: 2,
      dateMode: 'fiscal_year',
      startDate: '2025-10-01',
      endDate: '2026-09-30',
      fiscalYear: '2569',
      status: 'error',
      userAgent: 'Chrome / Windows',
      errorCode: 'SEARCH_FAILED',
    });
    expect(payload.queryText).toHaveLength(120);
    expect(payload.errorMessage).toHaveLength(200);
  });

  it('builds self-service export sheets from the filtered visible result set', () => {
    const sheets = buildSelfServiceExportSheets({
      email: 'viewer@example.com',
      deptName: 'ส่วนอำนวยการและสารบรรณ',
      queryMode: 'department',
      budgetOwner: 'ส่วนอำนวยการและสารบรรณ',
      matchedDeptCount: 1,
      startDate: '2026-06-01',
      endDate: '2026-06-11',
      fiscalYear: '2569',
      exportedAt: '2026-06-11 11:00',
      runData: [{ date: '02/06/2026', route: 'อาคาร A', round: 'เช้า', count: 1, note: 'ok' }],
      sortData: [{ date: '03/06/2026', normal: 2, register: 1, private: 0, total: 3 }],
      extData: [{ date: '04/06/2026', service: 'EMS', count: 1, cost: 37, fund: 'งบประมาณมหาวิทยาลัย', tracking: 'RL123456789TH' }],
    });

    expect(sheets.summary).toContainEqual(['อีเมลผู้ export', 'viewer@example.com']);
    expect(sheets.summary).toContainEqual(['จำนวนรับ-ส่งภายใน', 1]);
    expect(sheets.run).toHaveLength(2);
    expect(sheets.sort).toHaveLength(2);
    expect(sheets.ext[1]).toContain('RL123***89TH');
  });

  it('builds a filesystem-safe self-service export filename', () => {
    expect(buildSelfServiceExportFileName('ส่วน/อำนวยการ', '2026-06-01', '2026-06-11'))
      .toBe('DCG-Self-Service_ส่วน-อำนวยการ_2026-06-01_2026-06-11.xlsx');
  });
});

describe('self-service print report', () => {
  it('builds a print report with masked tracking and no staff email leakage', () => {
    const html = buildSelfServicePrintHtml({
      email: 'viewer@example.com',
      deptName: 'public department',
      queryMode: 'department',
      budgetOwner: 'public department',
      matchedDeptCount: 1,
      startDate: '2026-06-01',
      endDate: '2026-06-11',
      fiscalYear: '2569',
      exportedAt: '2026-06-11 11:00',
      runData: [{ date: '02/06/2026', route: 'A', round: 'AM', count: 1, note: 'ok', StaffEmail: 'staff@example.com' }],
      sortData: [],
      extData: [{ date: '04/06/2026', service: 'EMS', count: 1, cost: 37, fund: 'central', tracking: 'RL123456789TH', StaffEmail: 'staff@example.com' }],
    });

    expect(html).toContain('RL123***89TH');
    expect(html).not.toContain('RL123456789TH');
    expect(html).not.toContain('staff@example.com');
    expect(html).toContain('StaffEmail is excluded');
  });
});
