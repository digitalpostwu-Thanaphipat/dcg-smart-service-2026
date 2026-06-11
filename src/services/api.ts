import { API_URL } from '../config';
import { useAppStore } from '../store/useAppStore';
import { SelfServiceLogPayload } from '../utils/selfService';

const JSON_HEADERS = { 'Content-Type': 'text/plain' };

// ดึง Token จาก Zustand Store อย่างปลอดภัย (แก้ปัญหา Session Desync)
// รองรับ Fallback ดึงจาก sessionStorage เพื่อรักษาความเข้ากันได้กับชุดการทดสอบเดิม (Unit Tests)
const getAuthPayload = () => {
    const sessionToken = useAppStore.getState().sessionToken || sessionStorage.getItem('dcg_session_token');
    return sessionToken ? { sessionToken } : undefined;
};

// จัดการ response JSON อย่างปลอดภัย ป้องกันการโยน SyntaxError เมื่อได้คำตอบที่ไม่ใช่ JSON
const handleJsonResponse = async (res: Response) => {
    // สนับสนุน mock response ใน unit test ที่อาจไม่มีฟังก์ชัน text()
    if (typeof res.text !== 'function') {
        if (typeof res.json === 'function') {
            return await res.json();
        }
        throw new TypeError('Response object does not support text() or json() methods');
    }
    
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn('API returned non-JSON response:', text);
        return { 
            status: 'error', 
            message: text.trim() || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ (Invalid JSON)' 
        };
    }
};

export const api = {
    getHealth: async () => {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ action: 'getHealth' })
        });
        return await handleJsonResponse(res);
    },

    fetchMetaData: async (tokenOverride?: string) => {
        const authPayload = tokenOverride ? { sessionToken: tokenOverride } : getAuthPayload();
        const res = await fetch(API_URL, { 
            method: 'POST', 
            headers: JSON_HEADERS,
            body: JSON.stringify({ action: 'getMetaData', auth: authPayload }) 
        });
        return await handleJsonResponse(res);
    },

    fetchPublicMetaData: async () => {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ action: 'getPublicMetaData' })
        });
        return await handleJsonResponse(res);
    },

    searchLogs: async (filters: any, email: string) => {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            headers: JSON_HEADERS,
            body: JSON.stringify({ action: 'searchLogs', payload: { filters, email }, auth: getAuthPayload() }) 
        });
        return await handleJsonResponse(res);
    },

    requestSelfServiceOTP: async (email: string) => {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ action: 'requestSelfServiceOTP', payload: { email } })
        });
        const json = await handleJsonResponse(res);
        if (json.status === 'error') {
            throw new Error(json.message || 'การขอรหัส OTP สำหรับตรวจสอบข้อมูลล้มเหลว');
        }
        return json;
    },

    verifySelfServiceOTP: async (email: string, code: string) => {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ action: 'verifySelfServiceOTP', payload: { email, code } })
        });
        const json = await handleJsonResponse(res);
        if (json.status === 'error') {
            throw new Error(json.message || 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ');
        }
        return json;
    },

    publicSearch: async (
        deptName: string,
        selfServiceSessionToken?: string,
        options?: {
            queryMode?: 'department' | 'budget_owner';
            budgetOwner?: string;
            matchedDepartments?: string[];
            dateMode?: string;
            startDate?: string;
            endDate?: string;
            fiscalYear?: string;
            userAgent?: string;
        }
    ) => {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            headers: JSON_HEADERS,
            body: JSON.stringify({
                action: 'selfServiceSearch',
                payload: { deptName, ...options },
                auth: selfServiceSessionToken ? { selfServiceSessionToken } : undefined
            })
        });
        return await handleJsonResponse(res);
    },

    logSelfServiceEvent: async (payload: SelfServiceLogPayload, selfServiceSessionToken?: string) => {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify({
                    action: 'logSelfServiceEvent',
                    payload,
                    auth: selfServiceSessionToken ? { selfServiceSessionToken } : undefined
                })
            });
            return await handleJsonResponse(res);
        } catch (err) {
            console.warn('Self-service log event failed:', err);
            return { status: 'error', message: 'self-service log event failed' };
        }
    },

    saveBatch: async (payload: any) => {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            headers: JSON_HEADERS,
            body: JSON.stringify({ action: 'saveBatch', payload, auth: getAuthPayload() }) 
        });
        const json = await handleJsonResponse(res);
        if (json.status === 'error') {
            throw new Error(json.message || 'บันทึกข้อมูลล้มเหลว');
        }
        return json;
    },

    deleteLog: async (id: string, type: string) => {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            headers: JSON_HEADERS,
            body: JSON.stringify({ action: 'deleteLog', payload: { id, type }, auth: getAuthPayload() }) 
        });
        const json = await handleJsonResponse(res);
        if (json.status === 'error') {
            throw new Error(json.message || 'ลบข้อมูลล้มเหลว');
        }
        return json;
    },

    requestOTP: async (email: string) => {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ action: 'requestOTP', payload: { email } })
        });
        const json = await handleJsonResponse(res);
        if (json.status === 'error') {
            throw new Error(json.message || 'การขอรหัส OTP ล้มเหลว');
        }
        return json;
    },

    verifyOTP: async (email: string, code: string) => {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ action: 'verifyOTP', payload: { email, code } })
        });
        const json = await handleJsonResponse(res);
        if (json.status === 'error') {
            throw new Error(json.message || 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ');
        }
        return json;
    },

    submitFeedback: async (payload: { type: 'Bug' | 'Suggestion' | 'Other'; severity: 'Low' | 'Medium' | 'High' | 'Critical'; description: string; staffEmail: string }) => {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ action: 'feedback', payload, auth: getAuthPayload() })
        });
        const json = await handleJsonResponse(res);
        if (json.status === 'error') {
            throw new Error(json.message || 'บันทึกข้อเสนอแนะล้มเหลว');
        }
        return json;
    },

    checkConnection: async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        try {
            const res = await fetch(API_URL, { method: 'GET', signal: controller.signal });
            clearTimeout(timeoutId);
            return res.ok;
        } catch (e) {
            clearTimeout(timeoutId);
            return false;
        }
    }
};
