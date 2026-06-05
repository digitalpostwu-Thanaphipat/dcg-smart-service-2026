import { API_URL } from '../config';

// ดึง Token จาก Session Storage อย่างปลอดภัย
const getAuthPayload = () => {
    const sessionToken = sessionStorage.getItem('dcg_session_token');
    return sessionToken ? { sessionToken } : undefined;
};

export const api = {
    fetchMetaData: async () => {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'getMetaData', auth: getAuthPayload() }) 
        });
        return await res.json();
    },

    searchLogs: async (filters: any, email: string) => {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'searchLogs', payload: { filters, email }, auth: getAuthPayload() }) 
        });
        return await res.json();
    },

    publicSearch: async (deptName: string) => {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'publicSearch', payload: { deptName } }) 
        });
        return await res.json();
    },

    saveBatch: async (payload: any) => {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'saveBatch', payload, auth: getAuthPayload() }) 
        });
        const json = await res.json();
        if (json.status === 'error') {
            throw new Error(json.message || 'บันทึกข้อมูลล้มเหลว');
        }
        return json;
    },

    deleteLog: async (id: string, type: string) => {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'deleteLog', payload: { id, type }, auth: getAuthPayload() }) 
        });
        const json = await res.json();
        if (json.status === 'error') {
            throw new Error(json.message || 'ลบข้อมูลล้มเหลว');
        }
        return json;
    },

    requestOTP: async (email: string) => {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'requestOTP', payload: { email } })
        });
        const json = await res.json();
        if (json.status === 'error') {
            throw new Error(json.message || 'การขอรหัส OTP ล้มเหลว');
        }
        return json;
    },

    verifyOTP: async (email: string, code: string) => {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'verifyOTP', payload: { email, code } })
        });
        const json = await res.json();
        if (json.status === 'error') {
            throw new Error(json.message || 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ');
        }
        return json;
    },

    submitFeedback: async (payload: { type: 'Bug' | 'Suggestion' | 'Other'; severity: 'Low' | 'Medium' | 'High' | 'Critical'; description: string; staffEmail: string }) => {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'feedback', payload, auth: getAuthPayload() })
        });
        const json = await res.json();
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
