import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportPage } from './ReportPage';
import { useAppStore } from '../store/useAppStore';
import { api } from '../services/api';

vi.mock('../store/useAppStore', () => ({
    useAppStore: vi.fn(),
}));

vi.mock('../services/api', () => ({
    api: {
        searchLogs: vi.fn(),
        deleteLog: vi.fn(),
        logStaffReportEvent: vi.fn(),
    },
}));

vi.mock('../lib/db', () => ({
    getNonSyncedLogs: vi.fn().mockResolvedValue([]),
    deleteLogLocal: vi.fn(),
}));

describe('ReportPage', () => {
    const mockSetStatus = vi.fn();
    const mockSetLoading = vi.fn();
    const mockMasterData = {
        departments: [
            { DeptID: 'D001', DeptName: 'งานบัญชี', RouteGroup: 'สาย A', Building: 'อาคารบริหาร', BudgetOwner: 'ส่วนอำนวยการ' },
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
            setLoading: mockSetLoading,
            filters: {
                dateMode: 'today',
                startDate: '2026-06-10',
                endDate: '2026-06-10',
                dept: '',
                type: 'all',
            },
            // other fields...
        } as any);

        vi.mocked(api.searchLogs).mockResolvedValue({
            status: 'success',
            data: { run: [], sort: [], ext: [] },
        });
    });

    it('should render report tabs', () => {
        render(<ReportPage />);
        
        expect(screen.getByRole('tab', { name: /รายการข้อมูล/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /รับ-ส่งภายใน/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /คัดแยก-นำจ่าย/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /นำส่งภายนอก/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /สรุปงบประมาณ/i })).toBeInTheDocument();
    });

    it('should switch between report views', async () => {
        render(<ReportPage />);
        
        // Default tab is 'list'
        expect(screen.getByRole('tab', { name: /รายการข้อมูล/i })).toHaveAttribute('aria-selected', 'true');

        // Click on 'run' tab
        fireEvent.click(screen.getByRole('tab', { name: /รับ-ส่งภายใน/i }));

        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /รับ-ส่งภายใน/i })).toHaveAttribute('aria-selected', 'true');
        });
    });

    it('should call searchLogs on mount', async () => {
        render(<ReportPage />);
        
        await waitFor(() => {
            expect(api.searchLogs).toHaveBeenCalled();
        });
    });

    it('should show empty state when no logs', async () => {
        render(<ReportPage />);
        
        await waitFor(() => {
            expect(screen.getByText(/ไม่พบข้อมูลในช่วงเวลาที่เลือก/i)).toBeInTheDocument();
        });
    });

    it('should render action buttons', () => {
        render(<ReportPage />);

        // Check that action buttons exist
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
    });
});
