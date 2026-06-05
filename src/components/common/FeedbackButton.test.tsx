import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FeedbackButton } from './FeedbackButton';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../services/api';

// Mock the API service
vi.mock('../../services/api', () => ({
  api: {
    submitFeedback: vi.fn(),
  },
}));

describe('FeedbackButton Component', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useAppStore.setState({
      currentUser: {
        UserID: 'U001',
        Email: 'test@wu.ac.th',
        FullName: 'Test User',
        Role: 'Staff',
      },
      isOnline: true,
      status: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    useAppStore.setState({
      currentUser: null,
    });
  });

  it('should not render if user is not logged in', () => {
    useAppStore.setState({ currentUser: null });
    const { container } = render(<FeedbackButton />);
    expect(container.firstChild).toBeNull();
  });

  it('should render trigger button if user is logged in', () => {
    render(<FeedbackButton />);
    const triggerBtn = screen.getByRole('button', { name: /ส่งข้อเสนอแนะและแจ้งปัญหา/i });
    expect(triggerBtn).toBeInTheDocument();
  });

  it('should open modal when clicking trigger button', async () => {
    render(<FeedbackButton />);
    const triggerBtn = screen.getByRole('button', { name: /ส่งข้อเสนอแนะและแจ้งปัญหา/i });
    fireEvent.click(triggerBtn);

    const dialogTitle = await screen.findByText(/ส่งข้อเสนอแนะ \/ แจ้งปัญหาการใช้งาน/i);
    expect(dialogTitle).toBeInTheDocument();
    expect(screen.getByLabelText(/ประเภทของข้อเสนอแนะ/i)).toBeInTheDocument();
  });

  it('should close modal when pressing Escape', async () => {
    render(<FeedbackButton />);
    const triggerBtn = screen.getByRole('button', { name: /ส่งข้อเสนอแนะและแจ้งปัญหา/i });
    fireEvent.click(triggerBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    window.dispatchEvent(escEvent);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should validate description length before submission', async () => {
    render(<FeedbackButton />);
    const triggerBtn = screen.getByRole('button', { name: /ส่งข้อเสนอแนะและแจ้งปัญหา/i });
    fireEvent.click(triggerBtn);

    const descTextarea = screen.getByLabelText(/รายละเอียด/i);
    fireEvent.change(descTextarea, { target: { value: 'short' } }); // < 10 chars

    const submitBtn = screen.getByRole('button', { name: /ส่งข้อมูล/i });
    fireEvent.click(submitBtn);

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร');
    expect(api.submitFeedback).not.toHaveBeenCalled();
  });

  it('should successfully submit form and show status message', async () => {
    vi.mocked(api.submitFeedback).mockResolvedValue({ status: 'success', data: { message: 'ok' } });

    render(<FeedbackButton />);
    const triggerBtn = screen.getByRole('button', { name: /ส่งข้อเสนอแนะและแจ้งปัญหา/i });
    fireEvent.click(triggerBtn);

    const descTextarea = screen.getByLabelText(/รายละเอียด/i);
    fireEvent.change(descTextarea, { target: { value: 'รายละเอียดจำลองสำหรับทดสอบระบบ' } });

    const submitBtn = screen.getByRole('button', { name: /ส่งข้อมูล/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.submitFeedback).toHaveBeenCalledWith({
        type: 'Suggestion',
        severity: 'Low',
        description: 'รายละเอียดจำลองสำหรับทดสอบระบบ',
        staffEmail: 'test@wu.ac.th',
      });
    });

    await waitFor(() => {
      expect(useAppStore.getState().status).toEqual({
        type: 'success',
        text: 'บันทึกข้อเสนอแนะและปัญหาการใช้งานเรียบร้อยแล้ว',
      });
    });
  });
});
