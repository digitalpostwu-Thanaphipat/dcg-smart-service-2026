import { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { api } from './services/api';
import { MainLayout } from './components/layout/MainLayout';
import { RunPage } from './pages/RunPage';
import { SortPage } from './pages/SortPage';
import { ExternalPage } from './pages/ExternalPage';
import { ReportPage } from './pages/ReportPage';
import { Loader2, Sun, Moon } from 'lucide-react';
import { APP_NAME } from './config';
import { LoginView } from './components/auth/LoginView';
import { PublicTrackView } from './components/auth/PublicTrackView';
import { getMasterData as getLocalMasterData, setMasterData as setLocalMasterData } from './lib/db';
import { syncEngine } from './services/syncEngine';
import { useRegisterSW } from 'virtual:pwa-register/react';

const hasCompleteMasterData = (data: any) => (
  Array.isArray(data?.departments) &&
  data.departments.length > 0 &&
  Array.isArray(data?.services) &&
  data.services.length > 0
);

function App() {
  const {
    currentUser,
    setCurrentUser,
    setSessionToken,
    setMasterData,
    loading,
    setLoading,
    activeTab,
    sysConfig,
    setSysConfig,
    setShowAnnouncement,
    setStatus,
    theme,
    setTheme,
    setIsOnline
  } = useAppStore();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const [showPublicTrack, setShowPublicTrack] = useState(false);
  const [initialPublicDept, setInitialPublicDept] = useState('');

  // Sync theme mode with document HTML element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    fetchMetaData();
    
    // Check URL parameters for direct public view linking
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const dept = params.get('dept');
    if (view === 'public') {
      setShowPublicTrack(true);
      if (dept) {
        setInitialPublicDept(dept);
      }
    }
    
    // Verify connection and trigger sync if online
    const checkNetworkAndSync = async () => {
      const activeConnection = await api.checkConnection();
      setIsOnline(activeConnection);
      if (activeConnection) {
        syncEngine.syncPendingLogs();
      }
    };
    
    // Register sync triggers
    const handleOnline = () => {
      console.log('App: Browser online status detected.');
      checkNetworkAndSync();
    };
    
    const handleOffline = () => {
      console.log('App: Browser offline status detected.');
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Run initial sync on mount
    checkNetworkAndSync();
    
    // Periodic background validation & sync (every 30 seconds)
    const intervalId = setInterval(checkNetworkAndSync, 30000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, []);

  const fetchMetaData = async (tokenOverride?: string, options: { allowCache?: boolean } = {}) => {
    const allowCache = options.allowCache !== false;
    setLoading(true);
    try {
      const json = await api.fetchMetaData(tokenOverride);
      if (json.status === 'success' && hasCompleteMasterData(json.data)) {
        setMasterData(json.data);
        if (json.data.config && json.data.config.announcement) {
          setSysConfig(json.data.config);
          setShowAnnouncement(json.data.config.show);
        }
        // Cache to IndexedDB for offline support
        try {
          await setLocalMasterData('meta', json.data);
        } catch (dbErr) {
          console.error('Failed to cache metadata to IndexedDB:', dbErr);
        }
      } else {
        throw new Error(json.message || 'Master data response is incomplete');
      }
    } catch (e) {
      console.error('Network error fetching metadata, attempting to load from local cache:', e);
      if (!allowCache) {
        setStatus({
          type: 'error',
          text: 'Reload master data failed. Please logout/login or clear site data.',
        });
        setTimeout(() => setStatus(null), 5000);
        return;
      }
      try {
        const cached = await getLocalMasterData('meta');
        if (hasCompleteMasterData(cached)) {
          setMasterData(cached);
          if (cached.config && cached.config.announcement) {
            setSysConfig(cached.config);
            setShowAnnouncement(cached.config.show);
          }
        } else {
          throw new Error('Local master data cache is incomplete');
        }
      } catch (dbErr) {
        console.error('Failed to load metadata from IndexedDB:', dbErr);
        setStatus({
          type: 'error',
          text: 'Master data unavailable. Please logout/login or reload the app.',
        });
        setTimeout(() => setStatus(null), 5000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (email: string, fullName?: string, sessionToken?: string, role?: string, userID?: string) => {
    const user = {
      UserID: userID || '',
      Email: email,
      FullName: fullName || email.split('@')[0],
      Role: role || 'Staff'
    };
    setCurrentUser(user);
    if (sessionToken) {
      // Save the custom session token for Apps Script backend calls
      setSessionToken(sessionToken);
      // Immediately fetch metadata using the newly acquired session token
      fetchMetaData(sessionToken);
    }
  };

  if (showPublicTrack) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080E1C] text-slate-800 dark:text-slate-200 font-sans transition-colors duration-300 relative overflow-hidden flex flex-col justify-start">
        {/* Background glow similar to MainLayout */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] bg-purple-600 rounded-full blur-[140px] opacity-10 dark:opacity-[0.15] pointer-events-none" />
          <div className="absolute -bottom-[10%] -left-[10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[120px] opacity-5 dark:opacity-10 pointer-events-none" />
        </div>
        
        <div className="w-full max-w-2xl mx-auto px-4 py-8 md:py-12 relative z-10 space-y-6">
          {/* Top header & logo */}
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span className="bg-orange-500 w-2 h-6 rounded-full inline-block"></span>
                {sysConfig.appName || 'DCG Smart Service'}
              </h1>
              <p className="text-[9.5px] leading-relaxed text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">
                {sysConfig.appSubtitle || 'ส่วนอำนวยการสารบรรณ'}
              </p>
            </div>
            
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/5 text-slate-600 dark:text-slate-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
              title="สลับโหมดแสง/มืด"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          <div className="bg-white/70 dark:bg-slate-950/40 backdrop-blur-2xl border border-slate-200 dark:border-white/5 p-6 md:p-8 rounded-3xl shadow-xl">
            <PublicTrackView 
              onBack={() => setShowPublicTrack(false)} 
              initialDept={initialPublicDept}
            />
          </div>
        </div>
        {loading && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center">
            <Loader2 className="animate-spin text-purple-500 w-10 h-10" />
          </div>
        )}
      </div>
    );
  }

  if (!currentUser) return (
    <div className="flex h-screen items-center justify-center bg-[#0F172A] text-slate-200 p-4 font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-orange-950 rounded-full blur-[120px] opacity-20 pointer-events-none" />
      <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-950 rounded-full blur-[100px] opacity-10 pointer-events-none" />

      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-2xl w-full max-w-md text-center z-10">
        <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight leading-snug">
          {sysConfig.appName || APP_NAME}
        </h1>
        <p className="text-slate-400 mb-8 text-[10px] font-bold uppercase tracking-wider leading-relaxed">
          {sysConfig.appSubtitle || 'ระบบบันทึกข้อมูลการให้บริการงานไปรษณีย์ ส่วนอำนวยการสารบรรณ'}
        </p>

        <LoginView 
          onLogin={handleLogin} 
          onShowPublic={() => setShowPublicTrack(true)} 
        />
      </div>
    </div>
  );

  return (
    <>
      <MainLayout onRefreshMasterData={() => fetchMetaData(undefined, { allowCache: false })}>
        <div 
          id={`panel-${activeTab}`} 
          role="tabpanel" 
          aria-labelledby={`tab-${activeTab}`}
          className="w-full focus-visible:outline-none"
        >
          {activeTab === 'run' && <RunPage />}
          {activeTab === 'sort' && <SortPage />}
          {activeTab === 'ext' && <ExternalPage />}
          {activeTab === 'report' && <ReportPage />}
        </div>
        {loading && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center">
            <Loader2 className="animate-spin text-purple-500 w-10 h-10" />
          </div>
        )}
      </MainLayout>

      {/* PWA Update Banner */}
      {needRefresh && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-50 max-w-sm w-full bg-slate-950/90 backdrop-blur-xl border border-slate-200/10 p-5 rounded-3xl shadow-2xl text-white flex flex-col gap-3 font-sans animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">✨ ตรวจพบแอปพลิเคชันเวอร์ชันใหม่!</span>
            <span className="text-[10px] text-slate-400">กรุณาอัปเดตระบบเพื่อรับความเสถียรและฟีเจอร์ล่าสุด</span>
          </div>
          <div className="flex gap-2 justify-end">
            <button 
              onClick={() => setNeedRefresh(false)}
              className="px-3.5 py-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-[10px] font-bold transition-all active:scale-95"
            >
              ภายหลัง
            </button>
            <button 
              onClick={() => updateServiceWorker(true)}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold shadow-lg transition-all active:scale-95"
            >
              อัปเดตเดี๋ยวนี้
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
