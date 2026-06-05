import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Department, Service, LogItem } from '../types';

interface AppState {
  // --- Auth & User ---
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  
  // --- Master Data ---
  masterData: {
    users: User[];
    departments: Department[];
    services: Service[];
  } | null;
  setMasterData: (data: { users: User[]; departments: Department[]; services: Service[] } | null) => void;
  
  // --- UI State ---
  loading: boolean;
  setLoading: (loading: boolean) => void;
  activeTab: 'run' | 'sort' | 'ext' | 'report';
  setActiveTab: (tab: 'run' | 'sort' | 'ext' | 'report') => void;
  status: { type: 'success' | 'error', text: string } | null;
  setStatus: (status: { type: 'success' | 'error', text: string } | null) => void;
  showAnnouncement: boolean;
  setShowAnnouncement: (show: boolean) => void;
  sysConfig: { announcement: string; show: boolean; appName?: string; appSubtitle?: string; restrictWorkdays?: boolean };
  setSysConfig: (config: { announcement: string; show: boolean; appName?: string; appSubtitle?: string; restrictWorkdays?: boolean }) => void;

  // --- Operational State ---
  recentDepts: string[];
  addRecentDept: (deptName: string) => void;
  logs: LogItem[];
  setLogs: (logs: LogItem[]) => void;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  syncQueueCount: number;
  setSyncQueueCount: (count: number) => void;
  filters: {
    dateMode: 'today' | 'custom' | 'month' | 'fiscal';
    startDate: string;
    endDate: string;
    dept: string;
    type: string;
  };
  setFilters: (filters: any) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),
      theme: (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light',
      setTheme: (theme) => set({ theme }),
      
      masterData: null,
      setMasterData: (data) => set({ masterData: data }),
      
      loading: false,
      setLoading: (loading) => set({ loading }),
      
      activeTab: 'run',
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      status: null,
      setStatus: (status) => set({ status }),
      
      showAnnouncement: true,
      setShowAnnouncement: (show) => set({ showAnnouncement: show }),
      
      sysConfig: { 
        announcement: 'แจ้งเตือน: กรุณาบันทึกข้อมูลก่อนเวลา 16.00 น.', 
        show: true,
        appName: 'DCG Smart Service',
        appSubtitle: 'ระบบบันทึกข้อมูลการให้บริการงานไปรษณีย์ ส่วนอำนวยการสารบรรณ'
      },
      setSysConfig: (config) => set({ sysConfig: config }),
      
      recentDepts: [],
      addRecentDept: (deptName) => set((state) => {
        const newRecents = [deptName, ...state.recentDepts.filter(d => d !== deptName)].slice(0, 5);
        return { recentDepts: newRecents };
      }),
      
      logs: [],
      setLogs: (logs) => set({ logs }),
      
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      setIsOnline: (online) => set({ isOnline: online }),
      syncQueueCount: 0,
      setSyncQueueCount: (count) => set({ syncQueueCount: count }),
      
      filters: {
        dateMode: 'today',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dept: '',
        type: 'all'
      },
      setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
    }),
    {
      name: 'wus-track-storage',
      partialize: (state) => ({ 
        currentUser: state.currentUser,
        recentDepts: state.recentDepts,
        activeTab: state.activeTab,
        filters: state.filters,
        theme: state.theme
      }),
    }
  )
);
