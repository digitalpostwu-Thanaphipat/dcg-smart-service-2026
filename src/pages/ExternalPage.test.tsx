import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExternalPage } from './ExternalPage';
import { useAppStore } from '../store/useAppStore';

vi.mock('../store/useAppStore', () => ({
    useAppStore: vi.fn(),
}));

vi.mock('../services/syncEngine', () => ({
    syncEngine: {
        saveTransaction: vi.fn(),
    },
}));

describe('ExternalPage', () => {
    const mockSetStatus = vi.fn();
    const mockAddRecentDept = vi.fn();
    const mockMasterData = {
        departments: [
            { DeptID: 'D001', DeptName: 'งานบัญชี', RouteGroup: 'สาย A', Building: 'อาคารบริหาร', BudgetOwner: 'ส่วนอำนวยการ' },
        ],
        services: [
            { ServiceID: 'S001', ServiceName: 'EMS', Description: 'EMS' },
            { ServiceID: 'S002', ServiceName: 'พัสดุลงทะเบียน', Description: 'Registered' },
        ],
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

    it('should render external postage form', () => {
        render(<ExternalPage />);

        expect(screen.getByLabelText(/หน่วยงาน\/ผู้ส่ง/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/ประเภทบริการ/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/ค่าบริการ/i)).toBeInTheDocument();
    });

    it('should show fund source options', () => {
        render(<ExternalPage />);
        
        expect(screen.getByText(/งบประมาณมหาวิทยาลัย/i)).toBeInTheDocument();
    });

    it('should add item to cart', async () => {
        render(<ExternalPage />);

        // Input department
        const deptInput = screen.getByLabelText(/หน่วยงาน\/ผู้ส่ง/i);
        fireEvent.change(deptInput, { target: { value: 'งานบัญชี' } });

        // Select service
        const serviceSelect = screen.getByLabelText(/ประเภทบริการ/i);
        fireEvent.change(serviceSelect, { target: { value: 'EMS' } });

        // Input cost
        const costInput = screen.getByLabelText(/ค่าบริการ/i);
        fireEvent.change(costInput, { target: { value: '100' } });

        // Click add button
        const addButton = screen.getByRole('button', { name: /เพิ่มรายการส่งออก/i });
        fireEvent.click(addButton);

        await waitFor(() => {
            expect(screen.getByText('งานบัญชี')).toBeInTheDocument();
        });
    });

    it('should render without crashing', () => {
        const { container } = render(<ExternalPage />);
        expect(container).toBeTruthy();
    });
});
