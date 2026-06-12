import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'auth_required' | 'failed';

interface WUSTrackDB extends DBSchema {
  logs: {
    key: string;
    value: {
      id: string;
      type: 'run' | 'sort' | 'ext';
      data: any;
      timestamp: number;
      syncStatus: SyncStatus;
    };
    indexes: { 'by-type': string; 'by-status': string };
  };
  master_data: {
    key: string;
    value: any;
  };
  sync_queue: {
    key: string;
    value: {
      id: string;
      action: string;
      payload: any;
      timestamp: number;
      attempts: number;
      lastError?: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<WUSTrackDB>>;

export const initDB = () => {
  dbPromise = openDB<WUSTrackDB>('wus-track-db', 2, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        const logStore = db.createObjectStore('logs', { keyPath: 'id' });
        logStore.createIndex('by-type', 'type');
        logStore.createIndex('by-status', 'syncStatus');
        db.createObjectStore('master_data');
        db.createObjectStore('sync_queue', { keyPath: 'id' });
      }
      if (oldVersion === 1) {
        // Migration from v1 to v2 if necessary
        db.deleteObjectStore('metadata' as any);
        if (!db.objectStoreNames.contains('master_data')) {
          db.createObjectStore('master_data');
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }
        // Update logs store index
        const logStore = transaction.objectStore('logs');
        if (logStore.indexNames.contains('by-sync' as any)) {
          logStore.deleteIndex('by-sync' as any);
        }
        logStore.createIndex('by-status', 'syncStatus');
      }
    },
  });
};

export const saveLog = async (log: any) => {
  const db = await dbPromise;
  await db.put('logs', {
    ...log,
    syncStatus: 'pending',
    timestamp: Date.now(),
  });
};

export const getPendingLogs = async () => {
  const db = await dbPromise;
  const allLogs = await db.getAll('logs');
  return allLogs.filter((log) => log.syncStatus === 'pending' || log.syncStatus === 'auth_required');
};

export const getNonSyncedLogs = async () => {
  const db = await dbPromise;
  const allLogs = await db.getAll('logs');
  return allLogs.filter(l => l.syncStatus !== 'synced');
};

export const updateLogStatus = async (id: string, status: SyncStatus) => {
  const db = await dbPromise;
  const log = await db.get('logs', id);
  if (log) {
    log.syncStatus = status;
    await db.put('logs', log);
  }
};

export const deleteLogLocal = async (id: string) => {
  const db = await dbPromise;
  await db.delete('logs', id);
};


export const setMasterData = async (key: string, data: any) => {
  const db = await dbPromise;
  await db.put('master_data', data, key);
};

export const getMasterData = async (key: string) => {
  const db = await dbPromise;
  return db.get('master_data', key);
};
