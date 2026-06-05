import { Department } from '../types';

export const getDeptDisplay = (dept: Department) => dept.Building ? `${dept.DeptName} (${dept.Building})` : dept.DeptName;

export const getRealOwner = (deptName: string, departments?: Department[]) => {
    if (!departments) return deptName;
    const dept = departments.find(d => d.DeptName === deptName);
    return dept?.BudgetOwner || deptName;
};
