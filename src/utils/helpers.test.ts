import { describe, it, expect } from 'vitest';
import {
    departmentMatchesSearch,
    getBudgetOwnerEffective,
    getDateRange,
    getDeptDisplay,
    getDeptLocationDisplay,
    getRealOwner,
    normalizeDeptName,
    formatLocalDateTime,
    formatLocalDate,
} from './helpers';
import { Department } from '../types';

describe('helpers.ts utilities', () => {
    describe('getDeptDisplay', () => {
        it('should format display text with building if building exists', () => {
            const dept: Department = {
                DeptID: 'D001',
                DeptName: 'ส่วนอำนวยการ',
                RouteGroup: 'สาย A',
                Building: 'อาคารบริหาร',
                BudgetOwner: 'ส่วนอำนวยการ'
            };
            expect(getDeptDisplay(dept)).toBe('ส่วนอำนวยการ (อาคารบริหาร)');
        });

        it('should format display text with building and floor if both exist', () => {
            const dept: Department = {
                DeptID: 'D003',
                DeptName: 'งานบริการสารบรรณ',
                RouteGroup: 'สาย A',
                Building: 'อาคารบริหาร',
                Floor: 2,
                BudgetOwner: 'ส่วนอำนวยการ'
            };
            expect(getDeptDisplay(dept)).toBe('งานบริการสารบรรณ (อาคารบริหาร ชั้น 2)');
        });

        it('should return just DeptName if building is missing or empty', () => {
            const dept: Department = {
                DeptID: 'D002',
                DeptName: 'สำนักวิชาศิลปศาสตร์',
                RouteGroup: 'สาย B',
                Building: '',
                BudgetOwner: 'สำนักวิชาศิลปศาสตร์'
            };
            expect(getDeptDisplay(dept)).toBe('สำนักวิชาศิลปศาสตร์');
        });
    });

    describe('getRealOwner', () => {
        const mockDepts: Department[] = [
            { DeptID: 'D001', DeptName: 'ศูนย์คอมพิวเตอร์', RouteGroup: 'สาย A', Building: 'อาคารวิจัย', BudgetOwner: 'ส่วนบริการการศึกษา' },
            { DeptID: 'D002', DeptName: 'ส่วนอำนวยการ', RouteGroup: 'สาย B', Building: 'อาคารบริหาร', BudgetOwner: 'ส่วนอำนวยการ' }
        ];

        it('should return BudgetOwner if department is found', () => {
            expect(getRealOwner('ศูนย์คอมพิวเตอร์', mockDepts)).toBe('ส่วนบริการการศึกษา');
        });

        it('should return input name if department is not found', () => {
            expect(getRealOwner('สำนักวิชาแพทยศาสตร์', mockDepts)).toBe('สำนักวิชาแพทยศาสตร์');
        });

        it('should return input name if departments list is undefined', () => {
            expect(getRealOwner('ศูนย์คอมพิวเตอร์', undefined)).toBe('ศูนย์คอมพิวเตอร์');
        });

        it('should match department with trailing space', () => {
            expect(getRealOwner('ศูนย์คอมพิวเตอร์ ', mockDepts)).toBe('ส่วนบริการการศึกษา');
        });

        it('should match department with different case', () => {
            expect(getRealOwner('ศูนย์คอมพิวเตอร์', mockDepts)).toBe('ส่วนบริการการศึกษา');
        });
    });

    describe('department metadata helpers', () => {
        const dept: Department = {
            DeptID: 'D004',
            DeptName: 'งานย่อย A',
            RouteGroup: 'สาย A',
            Building: 'อาคารวิชาการ',
            Floor: '3',
            BudgetOwner: 'สำนักแม่'
        };

        it('should return BudgetOwnerEffective from BudgetOwner when present', () => {
            expect(getBudgetOwnerEffective(dept)).toBe('สำนักแม่');
        });

        it('should fallback BudgetOwnerEffective to DeptName when BudgetOwner is blank', () => {
            expect(getBudgetOwnerEffective({ ...dept, BudgetOwner: '' })).toBe('งานย่อย A');
        });

        it('should format location from building and floor', () => {
            expect(getDeptLocationDisplay(dept)).toBe('อาคารวิชาการ ชั้น 3');
        });

        it('should match search text against DeptName, Building, Floor, and BudgetOwner', () => {
            expect(departmentMatchesSearch(dept, 'งานย่อย')).toBe(true);
            expect(departmentMatchesSearch(dept, 'อาคารวิชาการ')).toBe(true);
            expect(departmentMatchesSearch(dept, 'ชั้น 3')).toBe(true);
            expect(departmentMatchesSearch(dept, 'สำนักแม่')).toBe(true);
            expect(departmentMatchesSearch(dept, 'ไม่พบคำนี้')).toBe(false);
        });
    });

    describe('normalizeDeptName', () => {
        it('should trim whitespace', () => {
            expect(normalizeDeptName('  ศูนย์คอมพิวเตอร์  ')).toBe('ศูนย์คอมพิวเตอร์');
        });

        it('should convert to lowercase', () => {
            expect(normalizeDeptName('ศูนย์คอมพิวเตอร์')).toBe('ศูนย์คอมพิวเตอร์');
        });

        it('should trim and lowercase together', () => {
            expect(normalizeDeptName('  ส่วนอำนวยการ  ')).toBe('ส่วนอำนวยการ');
        });
    });

    describe('formatLocalDateTime', () => {
        it('should format date in local time', () => {
            const date = new Date(2026, 5, 15, 14, 30, 45); // June 15, 2026 14:30:45
            expect(formatLocalDateTime(date)).toBe('2026-06-15 14:30:45');
        });

        it('should pad single digits with zeros', () => {
            const date = new Date(2026, 0, 5, 8, 5, 3); // Jan 5, 2026 08:05:03
            expect(formatLocalDateTime(date)).toBe('2026-01-05 08:05:03');
        });

        it('should handle midnight (00:00:00)', () => {
            const date = new Date(2026, 6, 1, 0, 0, 0); // July 1, 2026 00:00:00
            expect(formatLocalDateTime(date)).toBe('2026-07-01 00:00:00');
        });

        it('should handle 06:59 AM (edge case for timezone)', () => {
            const date = new Date(2026, 6, 1, 6, 59, 0); // July 1, 2026 06:59:00
            expect(formatLocalDateTime(date)).toBe('2026-07-01 06:59:00');
        });
    });

    describe('formatLocalDate', () => {
        it('should format date in local time', () => {
            const date = new Date(2026, 5, 15); // June 15, 2026
            expect(formatLocalDate(date)).toBe('2026-06-15');
        });

        it('should pad single digits with zeros', () => {
            const date = new Date(2026, 0, 5); // Jan 5, 2026
            expect(formatLocalDate(date)).toBe('2026-01-05');
        });
    });

    describe('getDateRange', () => {
        const baseDate = new Date('2026-06-09T12:00:00Z');

        it('should return today date for "today" mode', () => {
            const result = getDateRange({ dateMode: 'today', startDate: '', endDate: '' }, baseDate);
            expect(result).toEqual({ start: '2026-06-09', end: '2026-06-09' });
        });

        it('should return month start and end dates for "month" mode', () => {
            const result = getDateRange({ dateMode: 'month', startDate: '', endDate: '' }, baseDate);
            expect(result).toEqual({ start: '2026-06-01', end: '2026-06-30' });
        });

        it('should return fiscal year range for "fiscal" mode in June', () => {
            const result = getDateRange({ dateMode: 'fiscal', startDate: '', endDate: '' }, baseDate);
            expect(result).toEqual({ start: '2025-10-01', end: '2026-09-30' });
        });

        it('should return fiscal year range for "fiscal" mode in October', () => {
            const octDate = new Date('2026-10-05T12:00:00Z');
            const result = getDateRange({ dateMode: 'fiscal', startDate: '', endDate: '' }, octDate);
            expect(result).toEqual({ start: '2026-10-01', end: '2027-09-30' });
        });

        it('should return the custom range as is if startDate <= endDate', () => {
            const result = getDateRange({ dateMode: 'custom', startDate: '2026-05-01', endDate: '2026-06-01' }, baseDate);
            expect(result).toEqual({ start: '2026-05-01', end: '2026-06-01' });
        });

        it('should swap startDate and endDate if startDate > endDate (inverted range)', () => {
            const result = getDateRange({ dateMode: 'custom', startDate: '2026-06-01', endDate: '2026-05-01' }, baseDate);
            expect(result).toEqual({ start: '2026-05-01', end: '2026-06-01' });
        });
    });
});
