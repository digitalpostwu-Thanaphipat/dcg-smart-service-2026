import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './api';

describe('api.submitFeedback', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        sessionStorage.setItem('dcg_session_token', 'mock-session-token-456');
    });

    afterEach(() => {
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it('should successfully submit feedback with session token', async () => {
        const mockResponse = { status: 'success', message: 'บันทึกข้อเสนอแนะเรียบร้อยแล้ว' };
        (fetch as any).mockResolvedValue({
            json: async () => mockResponse,
        });

        const payload = {
            type: 'Bug' as const,
            severity: 'Critical' as const,
            description: 'ระบบขัดข้องไม่สามารถบันทึกข้อมูลได้',
            staffEmail: 'test@wu.ac.th'
        };

        const result = await api.submitFeedback(payload);

        expect(fetch).toHaveBeenCalledWith(expect.any(String), {
            method: 'POST',
            body: JSON.stringify({
                action: 'feedback',
                payload,
                auth: { sessionToken: 'mock-session-token-456' }
            })
        });
        expect(result).toEqual(mockResponse);
    });

    it('should throw an error if the server returns status error', async () => {
        const mockResponse = { status: 'error', message: 'เซสชันหมดอายุ' };
        (fetch as any).mockResolvedValue({
            json: async () => mockResponse,
        });

        const payload = {
            type: 'Other' as const,
            severity: 'Low' as const,
            description: 'รายละเอียดข้อเสนอแนะทั่วไป',
            staffEmail: 'test@wu.ac.th'
        };

        await expect(api.submitFeedback(payload)).rejects.toThrow('เซสชันหมดอายุ');
    });
});
