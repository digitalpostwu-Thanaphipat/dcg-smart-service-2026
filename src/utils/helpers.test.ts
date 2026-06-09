import { describe, it, expect } from 'vitest';
import { getDeptDisplay, getRealOwner, getDateRange } from './helpers';
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

