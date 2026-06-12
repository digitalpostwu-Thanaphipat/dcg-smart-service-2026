import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncEngine } from './syncEngine';
import { api } from './api';
import { useAppStore } from '../store/useAppStore';

type MockLog = {
  id: string;
  type: 'run' | 'sort' | 'ext';
  data: { items: any[]; common: any };
  timestamp: number;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'auth_required' | 'failed';
};

const mockDb = vi.hoisted(() => ({
  logs: [] as MockLog[],
}));

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock('./api', () => ({
  api: {
    saveBatch: vi.fn(),
  },
}));

vi.mock('../lib/db', () => ({
  saveLog: vi.fn(async (log: MockLog) => {
    mockDb.logs.push({ ...log, syncStatus: 'pending', timestamp: Date.now() });
  }),
  getPendingLogs: vi.fn(async () => (
    mockDb.logs.filter((log) => log.syncStatus === 'pending' || log.syncStatus === 'auth_required')
  )),
  updateLogStatus: vi.fn(async (id: string, status: MockLog['syncStatus']) => {
    const log = mockDb.logs.find((item) => item.id === id);
    if (log) log.syncStatus = status;
  }),
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

vi.mock('./txId', () => ({
  generateTxId: vi.fn(() => 'RUN-TEST-001'),
}));

describe('syncEngine - offline auth safety', () => {
  beforeEach(() => {
    mockDb.logs = [];
    vi.clearAllMocks();
    useAppStore.setState({
      currentUser: {
        UserID: 'U001',
        Email: 'staff@wu.ac.th',
        FullName: 'Staff User',
        Role: 'staff',
      },
      sessionToken: 'ST-VALID',
      logs: [],
      isOnline: true,
      syncQueueCount: 0,
    });
  });

  it('marks a pending log as auth_required without logging the user out when token expires', async () => {
    mockDb.logs = [
      {
        id: 'RUN-001',
        type: 'run',
        data: { items: [{ itemCount: 1 }], common: { route: 'A', round: 'AM' } },
        timestamp: Date.now(),
        syncStatus: 'pending',
      },
      {
        id: 'RUN-002',
        type: 'run',
        data: { items: [{ itemCount: 1 }], common: { route: 'B', round: 'PM' } },
        timestamp: Date.now(),
        syncStatus: 'pending',
      },
    ];
    useAppStore.setState({
      logs: [
        { id: 'RUN-001', timestamp: '', dept: 'A', desc: '', count: 1, type: 'run', syncStatus: 'pending' },
        { id: 'RUN-002', timestamp: '', dept: 'B', desc: '', count: 1, type: 'run', syncStatus: 'pending' },
      ],
    });
    vi.mocked(api.saveBatch).mockRejectedValue(new Error('Session expired: Authentication Required'));

    await syncEngine.syncPendingLogs();

    expect(mockDb.logs[0].syncStatus).toBe('auth_required');
    expect(mockDb.logs[1].syncStatus).toBe('pending');
    expect(useAppStore.getState().logs[0].syncStatus).toBe('auth_required');
    expect(useAppStore.getState().currentUser?.Email).toBe('staff@wu.ac.th');
    expect(useAppStore.getState().sessionToken).toBeNull();
    expect(useAppStore.getState().syncQueueCount).toBe(2);
    expect(toastMock.error).toHaveBeenCalledOnce();
  });

  it('retries auth_required logs after re-auth and marks them as synced', async () => {
    mockDb.logs = [
      {
        id: 'RUN-001',
        type: 'run',
        data: { items: [{ itemCount: 1 }], common: { route: 'A', round: 'AM' } },
        timestamp: Date.now(),
        syncStatus: 'auth_required',
      },
    ];
    useAppStore.setState({
      sessionToken: 'ST-NEW',
      logs: [
        { id: 'RUN-001', timestamp: '', dept: 'A', desc: '', count: 1, type: 'run', syncStatus: 'auth_required' },
      ],
    });
    vi.mocked(api.saveBatch).mockResolvedValue({ status: 'success' });

    await syncEngine.syncPendingLogs();

    expect(api.saveBatch).toHaveBeenCalledWith({
      txId: 'RUN-001',
      type: 'run',
      items: [{ itemCount: 1 }],
      common: { route: 'A', round: 'AM' },
    });
    expect(mockDb.logs[0].syncStatus).toBe('synced');
    expect(useAppStore.getState().logs[0].syncStatus).toBe('synced');
    expect(useAppStore.getState().syncQueueCount).toBe(0);
  });

  it('keeps pending logs local and skips API calls while offline', async () => {
    mockDb.logs = [
      {
        id: 'RUN-001',
        type: 'run',
        data: { items: [{ itemCount: 1 }], common: { route: 'A', round: 'AM' } },
        timestamp: Date.now(),
        syncStatus: 'pending',
      },
    ];
    useAppStore.setState({ isOnline: false });

    await syncEngine.syncPendingLogs();

    expect(api.saveBatch).not.toHaveBeenCalled();
    expect(mockDb.logs[0].syncStatus).toBe('pending');
    expect(useAppStore.getState().syncQueueCount).toBe(1);
  });

  it('keeps network failures pending for retry', async () => {
    mockDb.logs = [
      {
        id: 'RUN-001',
        type: 'run',
        data: { items: [{ itemCount: 1 }], common: { route: 'A', round: 'AM' } },
        timestamp: Date.now(),
        syncStatus: 'pending',
      },
    ];
    vi.mocked(api.saveBatch).mockRejectedValue(new TypeError('Failed to fetch'));

    await syncEngine.syncPendingLogs();

    expect(mockDb.logs[0].syncStatus).toBe('pending');
    expect(useAppStore.getState().syncQueueCount).toBe(1);
  });

  it('marks non-retryable sync errors as failed', async () => {
    mockDb.logs = [
      {
        id: 'RUN-001',
        type: 'run',
        data: { items: [{ itemCount: 1 }], common: { route: 'A', round: 'AM' } },
        timestamp: Date.now(),
        syncStatus: 'pending',
      },
    ];
    useAppStore.setState({
      logs: [
        { id: 'RUN-001', timestamp: '', dept: 'A', desc: '', count: 1, type: 'run', syncStatus: 'pending' },
      ],
    });
    vi.mocked(api.saveBatch).mockRejectedValue(new Error('Validation failed'));

    await syncEngine.syncPendingLogs();

    expect(mockDb.logs[0].syncStatus).toBe('failed');
    expect(useAppStore.getState().logs[0].syncStatus).toBe('failed');
    expect(useAppStore.getState().syncQueueCount).toBe(0);
  });
});
