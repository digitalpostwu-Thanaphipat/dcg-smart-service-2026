import { describe, it, expect } from 'vitest';
import { getDeptDisplay, getRealOwner } from './helpers';
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
});
