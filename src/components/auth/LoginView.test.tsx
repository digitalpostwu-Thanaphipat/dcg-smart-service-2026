import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginView } from './LoginView';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
    api: {
        requestOTP: vi.fn(),
        verifyOTP: vi.fn(),
    },
}));

describe('LoginView', () => {
    const mockOnLogin = vi.fn();
    const mockOnShowPublic = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render OTP request form', () => {
        render(<LoginView onLogin={mockOnLogin} onShowPublic={mockOnShowPublic} />);
        
        expect(screen.getByLabelText(/อีเมลมหาวิทยาลัยวลัยลักษณ์/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /ขอรหัสผ่านใช้ครั้งเดียว/i })).toBeInTheDocument();
    });

    it('should validate email before sending OTP', async () => {
        render(<LoginView onLogin={mockOnLogin} onShowPublic={mockOnShowPublic} />);

        const submitButton = screen.getByRole('button', { name: /ขอรหัสผ่านใช้ครั้งเดียว/i });
        fireEvent.click(submitButton);

        // Should not call API when email is empty
        await waitFor(() => {
            expect(api.requestOTP).not.toHaveBeenCalled();
        });
    });

    it('should call requestOTP on valid email', async () => {
        vi.mocked(api.requestOTP).mockResolvedValue({
            status: 'success',
            data: { message: 'OTP sent' },
        });

        render(<LoginView onLogin={mockOnLogin} onShowPublic={mockOnShowPublic} />);

        const emailInput = screen.getByLabelText(/อีเมลมหาวิทยาลัยวลัยลักษณ์/i);
        fireEvent.change(emailInput, { target: { value: 'test@wu.ac.th' } });

        const submitButton = screen.getByRole('button', { name: /ขอรหัสผ่านใช้ครั้งเดียว/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(api.requestOTP).toHaveBeenCalledWith('test@wu.ac.th');
        });
    });

    it('should show mock login button only on localhost', () => {
        // Mock localhost
        Object.defineProperty(window, 'location', {
            value: { hostname: 'localhost' },
        });

        render(<LoginView onLogin={mockOnLogin} onShowPublic={mockOnShowPublic} />);
        
        expect(screen.getByText(/โหมดนักพัฒนา/i)).toBeInTheDocument();
    });

    it('should not show mock login button on production', () => {
        // Mock production
        Object.defineProperty(window, 'location', {
            value: { hostname: 'dcg-smart-service-2026.vercel.app' },
        });

        render(<LoginView onLogin={mockOnLogin} onShowPublic={mockOnShowPublic} />);
        
        expect(screen.queryByText(/โหมดนักพัฒนา/i)).not.toBeInTheDocument();
    });

    it('should call onShowPublic when public link is clicked', () => {
        render(<LoginView onLogin={mockOnLogin} onShowPublic={mockOnShowPublic} />);

        const publicLink = screen.getByText(/ตรวจสอบการใช้บริการของหน่วยงาน/i);
        fireEvent.click(publicLink);

        expect(mockOnShowPublic).toHaveBeenCalled();
    });
});
