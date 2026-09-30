import { Department } from '../types';

const normalizeText = (value: unknown) => String(value ?? '').trim();

// Helper กลางสำหรับ normalize ชื่อหน่วยงาน — ใช้ซ้ำใน report/filter/search
export const normalizeDeptName = (name: string) => name.trim().toLowerCase();

export const getDeptLocationDisplay = (dept: Department) => {
    const building = normalizeText(dept.Building);
    const floor = normalizeText(dept.Floor);

    if (building && floor) return `${building} ชั้น ${floor}`;
    if (building) return building;
    if (floor) return `ชั้น ${floor}`;
    return '';
};

export const getDeptDisplay = (dept: Department) => {
    const location = getDeptLocationDisplay(dept);
    return location ? `${dept.DeptName} (${location})` : dept.DeptName;
};

export const getBudgetOwnerEffective = (dept: Department) => normalizeText(dept.BudgetOwner) || dept.DeptName;

export const getRealOwner = (deptName: string, departments?: Department[]) => {
    if (!departments) return deptName;
    const normalized = normalizeDeptName(deptName);
    const dept = departments.find(d => normalizeDeptName(d.DeptName) === normalized);
    return dept ? getBudgetOwnerEffective(dept) : deptName;
};

export const departmentMatchesSearch = (dept: Department, query: string) => {
    const q = normalizeText(query).toLowerCase();
    if (!q) return true;

    return [
        dept.DeptName,
        dept.Building,
        dept.Floor,
        `ชั้น ${normalizeText(dept.Floor)}`,
        getBudgetOwnerEffective(dept),
    ].some(value => normalizeDeptName(String(value ?? '')).includes(q));
};

export const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Format datetime ใน local time สำหรับ syncEngine และ ReportPage
// ใช้แทน toISOString() เพื่อให้ timestamp สอดคล้องกับ date filter
export const formatLocalDateTime = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
};

export const getDateRange = (
    filters: { dateMode: string; startDate: string; endDate: string },
    baseDate: Date = new Date()
) => {
    const todayStr = formatLocalDate(baseDate);

    switch (filters.dateMode) {
        case 'today':
            return { start: todayStr, end: todayStr };

        case 'month': {
            const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
            const lastDay = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
            return {
                start: formatLocalDate(firstDay),
                end: formatLocalDate(lastDay),
            };
        }

        case 'fiscal': {
            // ปีงบประมาณไทย: ต.ค. ปีก่อน -> ก.ย. ปีปัจจุบัน
            const year = baseDate.getMonth() >= 9 ? baseDate.getFullYear() : baseDate.getFullYear() - 1;
            return {
                start: `${year}-10-01`,
                end: `${year + 1}-09-30`,
            };
        }

        case 'custom':
        default: {
            const start = filters.startDate;
            const end = filters.endDate;
            if (start && end && start > end) {
                return { start: end, end: start };
            }
            return { start, end };
        }
    }
};
