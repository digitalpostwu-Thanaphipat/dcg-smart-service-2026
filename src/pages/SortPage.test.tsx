import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SortPage } from './SortPage';
import { useAppStore } from '../store/useAppStore';

vi.mock('../store/useAppStore', () => ({
    useAppStore: vi.fn(),
}));

vi.mock('../services/syncEngine', () => ({
    syncEngine: {
        saveTransaction: vi.fn(),
    },
}));

describe('SortPage', () => {
    const mockSetStatus = vi.fn();
    const mockAddRecentDept = vi.fn();
    const mockMasterData = {
        departments: [
            { DeptID: 'D001', DeptName: 'งานบัญชี', RouteGroup: 'สาย A', Building: 'อาคารบริหาร', BudgetOwner: 'ส่วนอำนวยการ' },
            { DeptID: 'D002', DeptName: 'งานพัสดุ', RouteGroup: 'สาย A', Building: 'อาคารบริหาร', BudgetOwner: 'ส่วนอำนวยการ' },
        ],
        services: [],
        users: [],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useAppStore).mockReturnValue({
            masterData: mockMasterData,
            currentUser: { Email: 'test@wu.ac.th', FullName: 'Test User', Role: 'Staff' },
            setStatus: mockSetStatus,
            addRecentDept: mockAddRecentDept,
            recentDepts: [],
            // other fields...
        } as any);
    });

    it('should render without crashing', () => {
        const { container } = render(<SortPage />);
        expect(container).toBeTruthy();
    });
});
