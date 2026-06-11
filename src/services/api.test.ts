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
            headers: { 'Content-Type': 'text/plain' },
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

describe('api self-service endpoints', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches backend health without auth for production diagnostics', async () => {
        const mockResponse = {
            status: 'success',
            data: { backendVersion: '2026-06-11-v28', departments: 83, services: 5 }
        };
        (fetch as any).mockResolvedValue({
            json: async () => mockResponse,
        });

        const result = await api.getHealth();

        expect(fetch).toHaveBeenCalledWith(expect.any(String), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'getHealth'
            })
        });
        expect(result).toEqual(mockResponse);
    });

    it('requests public search with the self-service session token', async () => {
        const mockResponse = {
            status: 'success',
            data: { run: [], sort: [], ext: [] }
        };
        (fetch as any).mockResolvedValue({
            json: async () => mockResponse,
        });

        const result = await api.publicSearch('สำนักอำนวยการ', 'SS-MOCKTOKEN123');

        expect(fetch).toHaveBeenCalledWith(expect.any(String), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'selfServiceSearch',
                payload: { deptName: 'สำนักอำนวยการ' },
                auth: { selfServiceSessionToken: 'SS-MOCKTOKEN123' }
            })
        });
        expect(result).toEqual(mockResponse);
    });

    it('fetches public metadata without staff auth for self-service department selection', async () => {
        const mockResponse = {
            status: 'success',
            data: { departments: [{ DeptName: 'สำนักอำนวยการ' }], services: [], config: {} }
        };
        (fetch as any).mockResolvedValue({
            json: async () => mockResponse,
        });

        const result = await api.fetchPublicMetaData();

        expect(fetch).toHaveBeenCalledWith(expect.any(String), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'getPublicMetaData'
            })
        });
        expect(result).toEqual(mockResponse);
    });

    it('uses separate OTP endpoints for self-service login', async () => {
        (fetch as any)
            .mockResolvedValueOnce({
                json: async () => ({ status: 'success', data: { message: 'sent' } }),
            })
            .mockResolvedValueOnce({
                json: async () => ({ status: 'success', data: { sessionToken: 'SS-MOCKTOKEN123' } }),
            });

        await api.requestSelfServiceOTP('viewer@example.com');
        await api.verifySelfServiceOTP('viewer@example.com', '123456');

        expect(fetch).toHaveBeenNthCalledWith(1, expect.any(String), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'requestSelfServiceOTP',
                payload: { email: 'viewer@example.com' }
            })
        });
        expect(fetch).toHaveBeenNthCalledWith(2, expect.any(String), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'verifySelfServiceOTP',
                payload: { email: 'viewer@example.com', code: '123456' }
            })
        });
    });

    it('sends self-service query mode and budget owner metadata when provided', async () => {
        (fetch as any).mockResolvedValue({
            json: async () => ({ status: 'success', data: { run: [], sort: [], ext: [] } }),
        });

        await api.publicSearch('หน่วยงานย่อย', 'SS-MOCKTOKEN123', {
            queryMode: 'budget_owner',
            budgetOwner: 'หน่วยงานแม่',
            matchedDepartments: ['หน่วยงานแม่', 'หน่วยงานย่อย'],
        });

        expect(fetch).toHaveBeenCalledWith(expect.any(String), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'selfServiceSearch',
                payload: {
                    deptName: 'หน่วยงานย่อย',
                    queryMode: 'budget_owner',
                    budgetOwner: 'หน่วยงานแม่',
                    matchedDepartments: ['หน่วยงานแม่', 'หน่วยงานย่อย'],
                },
                auth: { selfServiceSessionToken: 'SS-MOCKTOKEN123' }
            })
        });
    });

    it('sends browser self-service errors as best-effort log events', async () => {
        (fetch as any).mockResolvedValue({
            json: async () => ({ status: 'success', data: { logged: true } }),
        });

        await api.logSelfServiceEvent({
            email: 'viewer@example.com',
            action: 'self_service_error',
            queryText: 'dept',
            queryMode: 'department',
            selectedDeptName: 'dept',
            budgetOwnerEffective: 'dept',
            matchedDeptCount: 1,
            dateMode: 'today',
            startDate: '2026-06-11',
            endDate: '2026-06-11',
            fiscalYear: '2569',
            status: 'error',
            userAgent: 'Chrome / Windows',
            errorCode: 'SEARCH_FAILED',
            errorMessage: 'Network failed',
        }, 'SS-MOCKTOKEN123');

        expect(fetch).toHaveBeenCalledWith(expect.any(String), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'logSelfServiceEvent',
                payload: {
                    email: 'viewer@example.com',
                    action: 'self_service_error',
                    queryText: 'dept',
                    queryMode: 'department',
                    selectedDeptName: 'dept',
                    budgetOwnerEffective: 'dept',
                    matchedDeptCount: 1,
                    dateMode: 'today',
                    startDate: '2026-06-11',
                    endDate: '2026-06-11',
                    fiscalYear: '2569',
                    status: 'error',
                    userAgent: 'Chrome / Windows',
                    errorCode: 'SEARCH_FAILED',
                    errorMessage: 'Network failed',
                },
                auth: { selfServiceSessionToken: 'SS-MOCKTOKEN123' }
            })
        });
    });
});
