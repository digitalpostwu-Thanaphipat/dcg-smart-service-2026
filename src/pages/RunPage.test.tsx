import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RunPage } from './RunPage';
import { useAppStore } from '../store/useAppStore';
import { syncEngine } from '../services/syncEngine';

vi.mock('../store/useAppStore', () => ({
    useAppStore: vi.fn(),
}));

vi.mock('../services/syncEngine', () => ({
    syncEngine: {
        saveTransaction: vi.fn(),
    },
}));

describe('RunPage', () => {
    const mockSetStatus = vi.fn();
    const mockMasterData = {
        departments: [
            { DeptID: 'D001', DeptName: 'งานบัญชี', RouteGroup: 'สาย A', Building: 'อาคารบริหาร', BudgetOwner: 'ส่วนอำนวยการ' },
            { DeptID: 'D002', DeptName: 'งานพัสดุ', RouteGroup: 'สาย A', Building: 'อาคารบริหาร', BudgetOwner: 'ส่วนอำนวยการ' },
            { DeptID: 'D003', DeptName: 'งานบุคคล', RouteGroup: 'สาย B', Building: 'อาคารวิชาการ', BudgetOwner: 'สำนักวิชา' },
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
            // other fields...
        } as any);
    });

    it('should render route selector', () => {
        render(<RunPage />);
        
        expect(screen.getByLabelText(/เส้นทางรับ-ส่ง/i)).toBeInTheDocument();
    });

    it('should render round selector', () => {
        render(<RunPage />);
        
        expect(screen.getByLabelText(/รอบการส่ง/i)).toBeInTheDocument();
    });

    it('should show departments when route is selected', async () => {
        render(<RunPage />);
        
        const routeSelect = screen.getByLabelText(/เส้นทางรับ-ส่ง/i);
        fireEvent.change(routeSelect, { target: { value: 'สาย A' } });

        await waitFor(() => {
            expect(screen.getByText('งานบัญชี')).toBeInTheDocument();
            expect(screen.getByText('งานพัสดุ')).toBeInTheDocument();
        });
    });

    it('should not show departments from other routes', async () => {
        render(<RunPage />);
        
        const routeSelect = screen.getByLabelText(/เส้นทางรับ-ส่ง/i);
        fireEvent.change(routeSelect, { target: { value: 'สาย A' } });

        await waitFor(() => {
            expect(screen.queryByText('งานบุคคล')).not.toBeInTheDocument();
        });
    });

    it('should save transaction when submit button is clicked', async () => {
        vi.mocked(syncEngine.saveTransaction).mockResolvedValue('TX-001');

        render(<RunPage />);

        // Select route
        const routeSelect = screen.getByLabelText(/เส้นทางรับ-ส่ง/i);
        fireEvent.change(routeSelect, { target: { value: 'สาย A' } });

        await waitFor(() => {
            expect(screen.getByText('งานบัญชี')).toBeInTheDocument();
        });

        // Check first department
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);

        // Click save
        const saveButton = screen.getByRole('button', { name: /บันทึกการรับ-ส่ง/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(syncEngine.saveTransaction).toHaveBeenCalled();
        });
    });

    it('should show warning when no items selected', async () => {
        render(<RunPage />);

        const routeSelect = screen.getByLabelText(/เส้นทางรับ-ส่ง/i);
        fireEvent.change(routeSelect, { target: { value: 'สาย A' } });

        await waitFor(() => {
            expect(screen.getByText('งานบัญชี')).toBeInTheDocument();
        });

        // Click save without checking any items
        const saveButton = screen.getByRole('button', { name: /บันทึกการรับ-ส่ง/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(syncEngine.saveTransaction).not.toHaveBeenCalled();
        });
    });
});
