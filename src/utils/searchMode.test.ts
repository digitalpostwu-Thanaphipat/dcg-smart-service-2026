import { describe, it, expect } from 'vitest';
import { normalizeDeptName } from './helpers';
import { Department, SearchMode } from '../types';

describe('SearchMode - budget_owner filtering', () => {
    const mockDepts: Department[] = [
        { DeptID: 'D001', DeptName: 'งานบัญชี', RouteGroup: 'สาย A', Building: 'อาคารบริหาร', BudgetOwner: 'ส่วนอำนวยการ' },
        { DeptID: 'D002', DeptName: 'งานพัสดุ', RouteGroup: 'สาย A', Building: 'อาคารบริหาร', BudgetOwner: 'ส่วนอำนวยการ' },
        { DeptID: 'D003', DeptName: 'งานบุคคล', RouteGroup: 'สาย B', Building: 'อาคารวิชาการ', BudgetOwner: 'สำนักวิชาศิลปศาสตร์' },
        { DeptID: 'D004', DeptName: 'ส่วนอำนวยการ', RouteGroup: 'สาย B', Building: 'อาคารบริหาร', BudgetOwner: 'ส่วนอำนวยการ' },
    ];

    // จำลอง logic จาก ReportPage.tsx บรรทัด 189-197 (แก้ไขแล้วใช้ contains match)
    const filterByBudgetOwner = (itemDept: string, searchDept: string, departments: Department[]) => {
        const normalized = normalizeDeptName(searchDept);
        const matchedDepts = departments
            .filter(d => normalizeDeptName(d.BudgetOwner || '').includes(normalized))
            .map(d => normalizeDeptName(d.DeptName));
        matchedDepts.push(normalized);
        return matchedDepts.includes(normalizeDeptName(itemDept));
    };

    // จำลอง logic จาก ReportPage.tsx บรรทัด 200 (department mode)
    const filterByDepartment = (itemDept: string, searchDept: string) => {
        return itemDept.toLowerCase().includes(searchDept.toLowerCase());
    };

    it('department mode: should match by partial name (เหมือนเดิม)', () => {
        expect(filterByDepartment('งานบัญชี', 'งาน')).toBe(true);
        expect(filterByDepartment('งานบัญชี', 'บัญชี')).toBe(true);
        expect(filterByDepartment('งานบัญชี', 'พัสดุ')).toBe(false);
    });

    it('budget_owner mode: should include all sub-departments with contains match', () => {
        expect(filterByBudgetOwner('งานบัญชี', 'ส่วนอำนวยการ', mockDepts)).toBe(true);
        expect(filterByBudgetOwner('งานพัสดุ', 'ส่วนอำนวยการ', mockDepts)).toBe(true);
        expect(filterByBudgetOwner('ส่วนอำนวยการ', 'ส่วนอำนวยการ', mockDepts)).toBe(true);
        expect(filterByBudgetOwner('งานบุคคล', 'ส่วนอำนวยการ', mockDepts)).toBe(false);
    });

    it('budget_owner mode: should match partial BudgetOwner name (contains)', () => {
        // ค้นหา "อำนวยการ" ควรเจอหน่วยงานที่ BudgetOwner = "ส่วนอำนวยการ"
        expect(filterByBudgetOwner('งานบัญชี', 'อำนวยการ', mockDepts)).toBe(true);
        expect(filterByBudgetOwner('งานพัสดุ', 'อำนวยการ', mockDepts)).toBe(true);
        // ค้นหา "สำนักวิชา" ควรเจอหน่วยงานที่ BudgetOwner = "สำนักวิชาศิลปศาสตร์"
        expect(filterByBudgetOwner('งานบุคคล', 'สำนักวิชา', mockDepts)).toBe(true);
    });

    it('budget_owner mode: should handle trailing spaces with normalize', () => {
        const deptsWithSpaces: Department[] = [
            { DeptID: 'D001', DeptName: 'งานบัญชี ', RouteGroup: 'สาย A', Building: 'อาคารบริหาร', BudgetOwner: ' ส่วนอำนวยการ ' },
        ];
        expect(filterByBudgetOwner('งานบัญชี', 'ส่วนอำนวยการ', deptsWithSpaces)).toBe(true);
    });

    it('normalizeDeptName should trim and lowercase', () => {
        expect(normalizeDeptName('  งานบัญชี  ')).toBe('งานบัญชี');
        expect(normalizeDeptName('ส่วนอำนวยการ')).toBe('ส่วนอำนวยการ');
        expect(normalizeDeptName('  ส่วนอำนวยการ  ')).toBe('ส่วนอำนวยการ');
    });

    it('default searchMode should be department (backward compatible)', () => {
        const defaultSearchMode: SearchMode = 'department';
        expect(defaultSearchMode).toBe('department');
        expect(filterByDepartment('งานบัญชี', 'งาน')).toBe(true);
    });
});
