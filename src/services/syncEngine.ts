import { api } from './api';
import {
  saveLog,
  getPendingLogs,
  updateLogStatus
} from '../lib/db';
import { useAppStore } from '../store/useAppStore';
import { LogItem } from '../types';
import { toast } from 'sonner';
import { generateTxId } from './txId';

const isAuthError = (err: any) => {
  const errMsg = String(err?.message || err || '');
  return (
    errMsg.includes('เข้าสู่ระบบ') ||
    errMsg.includes('หมดอายุ') ||
    errMsg.includes('Session') ||
    errMsg.includes('Authentication') ||
    errMsg.includes('auth') ||
    errMsg.includes('Unauthorized')
  );
};

const isNetworkError = (err: any) => {
  const errMsg = String(err?.message || err || '');
  return (
    errMsg.includes('Failed to fetch') ||
    errMsg.includes('NetworkError') ||
    errMsg.includes('ERR_NETWORK') ||
    errMsg.includes('Load failed') ||
    err?.name === 'AbortError' ||
    err?.name === 'TypeError'
  );
};

const markLogInStore = (id: string, syncStatus: LogItem['syncStatus']) => {
  const store = useAppStore.getState();
  store.setLogs(
    store.logs.map(log => log.id === id ? { ...log, syncStatus } : log)
  );
};

const updateQueueCount = async () => {
  const currentPending = await getPendingLogs();
  useAppStore.getState().setSyncQueueCount(currentPending.length);
  return currentPending;
};

export const syncEngine = {
  syncPendingLogs: async () => {
    const store = useAppStore.getState();

    let pendingLogs = [];
    try {
      pendingLogs = await getPendingLogs();
      store.setSyncQueueCount(pendingLogs.length);
    } catch (e) {
      console.error('Failed to fetch pending logs from IndexedDB:', e);
      return;
    }

    if (pendingLogs.length === 0) return;

    const browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!store.isOnline || !browserOnline) {
      store.setSyncQueueCount(pendingLogs.length);
      return;
    }

    console.log(`SyncEngine: Found ${pendingLogs.length} pending logs. Starting sync...`);

    for (const log of pendingLogs) {
      try {
        await updateLogStatus(log.id, 'syncing');
        markLogInStore(log.id, 'syncing');

        await api.saveBatch({
          txId: log.id,
          type: log.type,
          items: log.data.items,
          common: log.data.common
        });

        await updateLogStatus(log.id, 'synced');
        await updateQueueCount();
        markLogInStore(log.id, 'synced');
        console.log(`SyncEngine: Log ${log.id} synced successfully.`);
      } catch (e: any) {
        console.error(`SyncEngine: Failed to sync log ${log.id}:`, e);

        if (isAuthError(e)) {
          await updateLogStatus(log.id, 'auth_required');
          await updateQueueCount();
          markLogInStore(log.id, 'auth_required');
          toast.error('สิทธิ์การใช้งานหมดอายุ ต้องยืนยัน OTP ใหม่ก่อนซิงค์ข้อมูล', {
            description: 'ข้อมูลที่บันทึกไว้ยังอยู่ในเครื่องและจะซิงค์ต่อหลังยืนยันตัวตนใหม่',
            duration: 6000
          });
          store.setSessionToken(null);
          break;
        }

        const retryable = isNetworkError(e);
        await updateLogStatus(log.id, retryable ? 'pending' : 'failed');
        await updateQueueCount();
        markLogInStore(log.id, retryable ? 'pending' : 'failed');
      }
    }
  },

  saveTransaction: async (type: 'run' | 'sort' | 'ext', items: any[], common: any) => {
    const store = useAppStore.getState();

    const now = new Date();
    const txId = generateTxId(type, now);
    const timestampStr = now.toISOString().replace('T', ' ').substring(0, 19);

    let desc = '';
    let count = 0;
    let cost = undefined;
    let fund = undefined;

    if (type === 'run') {
      desc = `${common.route} (${common.round})`;
      count = items.reduce((sum, item) => sum + (parseInt(item.itemCount) || 0), 0);
    } else if (type === 'sort') {
      const normal = items.reduce((sum, item) => sum + (parseInt(item.normalCount) || 0), 0);
      const reg = items.reduce((sum, item) => sum + (parseInt(item.registerCount) || 0), 0);
      desc = `ธรรมดา: ${normal}, ลงทะเบียน: ${reg}`;
      count = items.reduce((sum, item) => sum + (parseInt(item.total) || 0), 0);
    } else if (type === 'ext') {
      const first = items[0];
      desc = `${first.serviceType} ${first.trackingNo || ''}`;
      count = items.reduce((sum, item) => sum + (parseInt(item.itemCount) || 0), 0);
      cost = items.reduce((sum, item) => sum + (parseInt(item.cost) || 0), 0);
      fund = first.fundSource;
    }

    const newLog: LogItem = {
      id: txId,
      timestamp: timestampStr,
      dept: items.length === 1 ? items[0].deptName : `${items.length} หน่วยงาน`,
      desc,
      count,
      cost,
      type,
      fund,
      syncStatus: 'pending'
    };

    const dbLog = {
      id: txId,
      type,
      data: { items, common },
      timestamp: Date.now(),
      syncStatus: 'pending' as const
    };

    try {
      await saveLog(dbLog);
      await updateQueueCount();
    } catch (e) {
      console.error('Failed to save log to IndexedDB:', e);
      throw e;
    }

    store.setLogs([newLog, ...store.logs]);
    syncEngine.syncPendingLogs();

    return txId;
  }
};
