import { api } from './api';
import { 
  saveLog, 
  getPendingLogs, 
  updateLogStatus 
} from '../lib/db';
import { useAppStore } from '../store/useAppStore';
import { LogItem } from '../types';
import { toast } from 'sonner';

export const syncEngine = {
  // Sync all pending logs from IndexedDB to the API
  syncPendingLogs: async () => {
    const store = useAppStore.getState();
    
    let pendingLogs = [];
    try {
      pendingLogs = await getPendingLogs();
      store.setSyncQueueCount(pendingLogs.length);
    } catch (e) {
      console.error("Failed to fetch pending logs from IndexedDB:", e);
      return;
    }

    if (pendingLogs.length === 0) return;

    console.log(`SyncEngine: Found ${pendingLogs.length} pending logs. Starting sync...`);
    
    for (const log of pendingLogs) {
      try {
        await updateLogStatus(log.id, 'syncing');
        
        // Update Zustand store status
        store.setLogs(
          store.logs.map(l => l.id === log.id ? { ...l, syncStatus: 'syncing' } : l)
        );

        // Call API to save batch
        await api.saveBatch({
          txId: log.id,
          type: log.type,
          items: log.data.items,
          common: log.data.common
        });

        // Mark as synced in IndexedDB
        await updateLogStatus(log.id, 'synced');

        // Update sync queue count
        const currentPending = await getPendingLogs();
        store.setSyncQueueCount(currentPending.length);

        // Update Zustand store status to synced
        store.setLogs(
          store.logs.map(l => l.id === log.id ? { ...l, syncStatus: 'synced' } : l)
        );
        console.log(`SyncEngine: Log ${log.id} synced successfully.`);
      } catch (e: any) {
        console.error(`SyncEngine: Failed to sync log ${log.id}:`, e);
        // Reset status to pending to retry later
        await updateLogStatus(log.id, 'pending');
        
        const currentPending = await getPendingLogs();
        store.setSyncQueueCount(currentPending.length);

        store.setLogs(
          store.logs.map(l => l.id === log.id ? { ...l, syncStatus: 'pending' } : l)
        );

        // Check for session/authentication expired errors
        const errMsg = e.message || '';
        if (
          errMsg.includes('เข้าสู่ระบบ') || 
          errMsg.includes('หมดอายุ') || 
          errMsg.includes('Session') || 
          errMsg.includes('Authentication') || 
          errMsg.includes('auth') ||
          errMsg.includes('Unauthorized')
        ) {
          toast.error('สิทธิ์การใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้งเพื่ออัปโหลดข้อมูล', {
            description: 'ระบบตรวจพบว่าเซสชันเชื่อมต่อของคุณหมดอายุแล้ว',
            duration: 6000
          });
          // Force logout to resolve desync
          store.setCurrentUser(null);
          store.setSessionToken(null);
        }
      }
    }
  },

  // Save transaction locally first (Optimistic UI) and trigger background sync
  saveTransaction: async (type: 'run' | 'sort' | 'ext', items: any[], common: any) => {
    const store = useAppStore.getState();
    
    // Generate unique ID and timestamp in the old style: PREFIX-YYYYMMDD-RAND4
    const prefix = type.toUpperCase();
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    const rand = Array.from({ length: 4 }, () => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36))
    ).join('');
    const txId = `${prefix}-${dateStr}-${rand}`;
    const timestampStr = now.toISOString().replace('T', ' ').substring(0, 19);

    // Format description and calculations
    let desc = '';
    let count = 0;
    let cost = undefined;
    let fund = undefined;

    if (type === 'run') {
      desc = `${common.route} (${common.round})`;
      count = items.reduce((sum, i) => sum + (parseInt(i.itemCount) || 0), 0);
    } else if (type === 'sort') {
      const normal = items.reduce((sum, i) => sum + (parseInt(i.normalCount) || 0), 0);
      const reg = items.reduce((sum, i) => sum + (parseInt(i.registerCount) || 0), 0);
      desc = `ธ: ${normal}, ลบ: ${reg}`;
      count = items.reduce((sum, i) => sum + (parseInt(i.total) || 0), 0);
    } else if (type === 'ext') {
      const first = items[0];
      desc = `${first.serviceType} ${first.trackingNo || ''}`;
      count = items.reduce((sum, i) => sum + (parseInt(i.itemCount) || 0), 0);
      cost = items.reduce((sum, i) => sum + (parseInt(i.cost) || 0), 0);
      fund = first.fundSource;
    }

    // Create log item for local display
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

    // Save transaction object to IndexedDB logs store
    const dbLog = {
      id: txId,
      type,
      data: { items, common },
      timestamp: Date.now(),
      syncStatus: 'pending' as const
    };
    
    try {
      await saveLog(dbLog);
      const currentPending = await getPendingLogs();
      store.setSyncQueueCount(currentPending.length);
    } catch (e) {
      console.error("Failed to save log to IndexedDB:", e);
    }

    // Prepend to store state optimistically
    store.setLogs([newLog, ...store.logs]);
    
    // Trigger non-blocking background sync
    syncEngine.syncPendingLogs();
    
    return txId;
  }
};
