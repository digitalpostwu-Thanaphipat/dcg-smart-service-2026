import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, Mail, Package, FileText, LogOut, 
  Sun, Moon, CloudSun, Bell, X,
  CheckCircle2, User, RefreshCw
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { THEMES } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';
import { syncEngine } from '../../services/syncEngine';
import { FeedbackButton } from '../common/FeedbackButton';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { 
    currentUser, 
    setCurrentUser, 
    activeTab, 
    setActiveTab, 
    status, 
    sysConfig,
    showAnnouncement,
    setShowAnnouncement,
    theme,
    setTheme,
    isOnline,
    syncQueueCount
  } = useAppStore();

  const [todayStats, setTodayStats] = useState({ run: 0, sort: 0, ext: 0 });

  const themeConfig = THEMES[activeTab] || THEMES.default;

  // Sync theme mode with document HTML element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Fetch today's stats for the Progress Tracker
  const fetchTodayLogs = async () => {
    if (!currentUser) return;
    try {
      const json = await api.searchLogs({
        dateMode: 'today',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dept: '',
        type: 'all'
      }, currentUser.Email);
      
      if (json.status === 'success') {
        const list: any[] = [];
        if (json.data.run) json.data.run.forEach((r: any) => list.push({ type: 'run', count: parseInt(r.ItemCount) || 0 }));
        if (json.data.sort) json.data.sort.forEach((r: any) => list.push({ type: 'sort', count: parseInt(r.Total) || 0 }));
        if (json.data.ext) json.data.ext.forEach((r: any) => list.push({ type: 'ext', count: parseInt(r.ItemCount) || 0 }));
        
        setTodayStats({
          run: list.filter(l => l.type === 'run').reduce((s, l) => s + l.count, 0),
          sort: list.filter(l => l.type === 'sort').reduce((s, l) => s + l.count, 0),
          ext: list.filter(l => l.type === 'ext').reduce((s, l) => s + l.count, 0),
        });
      }
    } catch (err) {
      console.error("Failed to fetch today's stats", err);
    }
  };

  useEffect(() => {
    fetchTodayLogs();
    const interval = setInterval(fetchTodayLogs, 30000);
    return () => clearInterval(interval);
  }, [currentUser, activeTab]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return { text: 'สวัสดีตอนเช้า', icon: <Sun size={16} className="text-yellow-500 dark:text-yellow-300" /> };
    if (h < 18) return { text: 'สวัสดีตอนบ่าย', icon: <CloudSun size={16} className="text-orange-500 dark:text-orange-300" /> };
    return { text: 'สวัสดีตอนเย็น', icon: <Moon size={16} className="text-blue-500 dark:text-blue-200" /> };
  };

  const greeting = getGreeting();

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('google_id_token');
    sessionStorage.removeItem('dcg_session_token');
  };

  const runProgress = Math.min(100, Math.round((todayStats.run / 50) * 100));
  const sortProgress = Math.min(100, Math.round((todayStats.sort / 100) * 100));
  const extProgress = Math.min(100, Math.round((todayStats.ext / 30) * 100));

  const navItems = [
    { id: 'run', icon: Truck, label: 'รับ-ส่งเอกสารภายใน', themeColor: 'text-blue-500', bgColor: 'bg-blue-500' },
    { id: 'sort', icon: Mail, label: 'คัดแยกไปรษณีย์ภัณฑ์', themeColor: 'text-orange-500', bgColor: 'bg-orange-500' },
    { id: 'ext', icon: Package, label: 'นำส่งไปรษณีย์ภายนอก', themeColor: 'text-green-500', bgColor: 'bg-green-500' },
    { id: 'report', icon: FileText, label: 'รายงานผลการดำเนินงาน', themeColor: 'text-purple-500', bgColor: 'bg-[#6A2C70]' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080E1C] text-slate-800 dark:text-slate-200 font-sans transition-colors duration-300 flex flex-col md:flex-row">
      
      {/* Dynamic Background Blurs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className={cn(
          "absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[140px] opacity-10 dark:opacity-[0.15] transition-colors duration-1000",
          themeConfig.bg
        )} />
        <div className="absolute -bottom-[10%] -left-[10%] w-[50%] h-[50%] bg-purple-900/40 rounded-full blur-[120px] opacity-5 dark:opacity-10" />
      </div>

      {/* LEFT SIDEBAR - Desktop/PC Only (md:flex) */}
      <aside className="hidden md:flex md:w-80 flex-shrink-0 flex-col justify-between border-r border-slate-200/50 dark:border-white/5 bg-white/40 dark:bg-slate-950/40 backdrop-blur-2xl p-6 sticky top-0 h-screen transition-colors duration-300 z-30">
        <div className="space-y-6">
          
          {/* Brand/App Title */}
          <div className="space-y-1.5 py-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span className="bg-orange-500 w-2 h-6 rounded-full inline-block"></span>
              {sysConfig.appName || 'DCG Smart Service'}
            </h1>
            <p className="text-[9.5px] leading-relaxed text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">
              {sysConfig.appSubtitle || 'ระบบบันทึกข้อมูลการให้บริการงานไปรษณีย์ ส่วนอำนวยการสารบรรณ'}
            </p>
          </div>

          {/* User Profile Info */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/50 dark:bg-white/[0.03] border border-white/40 dark:border-white/5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-purple-600 dark:bg-purple-700 text-white flex items-center justify-center font-bold shadow-md">
              <User size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {greeting.icon} {greeting.text}
              </div>
              <h2 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                {currentUser?.FullName || 'Guest Staff'}
              </h2>
            </div>
          </div>

          {/* Connection & Sync Status Indicator (Desktop) */}
          <div className={cn(
            "flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-[9px] font-bold transition-all shadow-sm",
            isOnline 
              ? syncQueueCount > 0 
                ? "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400" 
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse"
          )}>
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full inline-block",
                isOnline 
                  ? syncQueueCount > 0 ? "bg-purple-500 animate-pulse" : "bg-emerald-500" 
                  : "bg-amber-500"
              )} />
              <span>
                {isOnline 
                  ? syncQueueCount > 0 ? `รออัปโหลดข้อมูล (${syncQueueCount})` : "เชื่อมต่อออนไลน์" 
                  : `โหมดออฟไลน์ (${syncQueueCount} รอซิงค์)`}
              </span>
            </div>
            {syncQueueCount > 0 && isOnline && (
              <button 
                onClick={() => syncEngine.syncPendingLogs()} 
                className="hover:underline flex items-center gap-0.5 text-purple-500 dark:text-purple-400"
                title="ซิงค์ข้อมูลเดี๋ยวนี้"
              >
                <RefreshCw size={8} className="animate-spin" /> ซิงค์
              </button>
            )}
          </div>

          {/* Navigation Items (PC Layout) */}
          <nav className="space-y-1.5" role="tablist" aria-label="เมนูหลักการดำเนินงาน">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${item.id}`}
                  id={`tab-${item.id}`}
                  className={cn(
                    "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all relative focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none",
                    isActive 
                      ? "bg-white dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white shadow-[0_4px_12px_rgba(0,0,0,0.03)]" 
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-xl transition-all shadow-sm",
                    isActive 
                      ? cn(item.bgColor, item.id === 'ext' ? "text-slate-950" : "text-white") 
                      : "bg-slate-100 dark:bg-slate-900/60 text-slate-400"
                  )}>
                    <Icon size={16} />
                  </div>
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="active-indicator-pc"
                      className={cn("absolute right-3 w-1.5 h-1.5 rounded-full", item.bgColor)}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Progress Tracking Cards */}
          <div className="p-4 rounded-2xl glass-card-premium space-y-3.5 border border-slate-200/50 dark:border-white/5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">ความคืบหน้าของวันนี้</h3>
              <span className="text-[10px] text-slate-400 font-bold hover:underline cursor-pointer" onClick={fetchTodayLogs}>
                รีเฟรช
              </span>
            </div>
            
            <div className="space-y-2.5">
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-slate-500">รับ-ส่งภายใน</span>
                  <span className="text-blue-500">{todayStats.run} / 50 ซอง ({runProgress}%)</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${runProgress}%` }}></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-slate-500">คัดแยกไปรษณีย์</span>
                  <span className="text-orange-500">{todayStats.sort} / 100 ชิ้น ({sortProgress}%)</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${sortProgress}%` }}></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-slate-500">นำส่งภายนอก</span>
                  <span className="text-green-500">{todayStats.ext} / 30 ชิ้น ({extProgress}%)</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${extProgress}%` }}></div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Sidebar Footer Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200/50 dark:border-white/5">
          <button 
            onClick={toggleTheme}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-800/60 border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-slate-200 rounded-xl transition-all active:scale-95 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none"
            title="สลับโหมดแสง/มืด"
            aria-label="สลับโหมดแสง/มืด"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-600 dark:text-rose-400 hover:text-white rounded-xl text-[11px] font-bold transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none"
            aria-label="ออกจากระบบ"
          >
            <LogOut size={14} />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Right Column Container */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* MOBILE HEADER - Only on Mobile/Tablet (md:hidden) */}
        <header className="md:hidden sticky top-0 z-40 backdrop-blur-md bg-white/70 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-white/5 transition-colors duration-300">
          <div className="max-w-xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className={cn("p-1.5 rounded-lg text-white shadow-md", themeConfig.bg)}>
                {themeConfig.icon}
              </div>
              <div>
                <h1 className="text-xs font-black text-slate-800 dark:text-white">
                  {sysConfig.appName || 'DCG Smart Service'}
                </h1>
                <p className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">
                  {sysConfig.appSubtitle || 'ส่วนอำนวยการสารบรรณ'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Connection & Sync Status Indicator (Mobile) */}
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[8px] font-bold transition-all shadow-sm",
                isOnline 
                  ? syncQueueCount > 0 
                    ? "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400" 
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse"
              )}>
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full inline-block",
                  isOnline 
                    ? syncQueueCount > 0 ? "bg-purple-500 animate-pulse" : "bg-emerald-500" 
                    : "bg-amber-500"
                )} />
                <span className="hidden sm:inline">
                  {isOnline 
                    ? syncQueueCount > 0 ? `ซิงค์ (${syncQueueCount})` : "ออนไลน์" 
                    : `ออฟไลน์ (${syncQueueCount})`}
                </span>
                {syncQueueCount > 0 && <span className="sm:hidden">{syncQueueCount}</span>}
              </div>

              <button 
                onClick={toggleTheme}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-slate-200 rounded-xl transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none"
                aria-label="สลับธีม"
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>

              <button 
                onClick={handleLogout}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 text-slate-700 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 border border-slate-200/60 dark:border-white/5 rounded-xl transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none"
                aria-label="ออกจากระบบ"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Announcements */}
        <AnimatePresence>
          {showAnnouncement && sysConfig.show && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-500/10 border-b border-amber-500/20 overflow-hidden relative z-20 w-full"
            >
              <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bell size={13} className="text-amber-600 dark:text-amber-500 flex-shrink-0" />
                  <p className="text-[10px] font-bold text-amber-800 dark:text-amber-200/80 leading-normal">
                    {sysConfig.announcement}
                  </p>
                </div>
                <button onClick={() => setShowAnnouncement(false)} className="text-amber-600/50 hover:text-amber-600 dark:text-amber-500/50 dark:hover:text-amber-500 transition-colors">
                  <X size={13} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sync Status Toast Notification */}
        <AnimatePresence>
          {status && (
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="fixed top-20 left-0 right-0 z-50 px-4 pointer-events-none"
            >
              <div 
                role="status" 
                aria-live="polite"
                className={cn(
                  "max-w-xs mx-auto p-3.5 rounded-2xl border shadow-2xl flex items-center gap-3.5 backdrop-blur-xl",
                  status.type === 'success' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-800 dark:text-emerald-200" : "bg-rose-500/20 border-rose-500/30 text-rose-800 dark:text-rose-200"
                )}
              >
                <div className={cn("p-1 rounded-full text-white", status.type === 'success' ? "bg-emerald-500" : "bg-rose-500")}>
                  <CheckCircle2 size={12} className="text-white" />
                </div>
                <p className="text-[11px] font-extrabold tracking-tight">{status.text}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN VIEWPORT PANEL */}
        <main className="flex-1 overflow-x-hidden z-10">
          <div className="w-full max-w-5xl mx-auto px-4 py-6 md:py-10 pb-32 md:pb-12">
            
            {/* Header Title inside Content (Desktop only) */}
            <div className="hidden md:flex items-center gap-3.5 mb-8">
              <div className={cn("w-1 h-7 rounded-full shadow-md", themeConfig.bgColor)} />
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                  {themeConfig.name}
                </h2>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                  ระบบจัดการและเก็บบันทึกข้อมูลไปรษณีย์ภัณฑ์
                </p>
              </div>
            </div>

            {/* Children views */}
            {children}
          </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION - Smartphone/Tablet Only (md:hidden) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/80 backdrop-blur-2xl border-t border-slate-200/60 dark:border-white/5 pb-safe transition-colors duration-300" role="tablist" aria-label="เมนูหลักการดำเนินงานมือถือ">
        <div className="max-w-xl mx-auto px-4 py-2.5 flex justify-between items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${item.id}`}
                id={`mobtab-${item.id}`}
                className="relative flex flex-col items-center gap-1 group flex-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none rounded-xl"
              >
                <div className={cn(
                  "p-2 rounded-xl transition-all duration-300",
                  isActive 
                    ? cn(item.bgColor, item.id === 'ext' ? "text-slate-950" : "text-white", "shadow-md scale-105") 
                    : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                )}>
                  <Icon size={18} />
                </div>
                <span className={cn(
                  "text-[9px] font-bold transition-colors tracking-tight",
                  isActive ? "text-slate-800 dark:text-white" : "text-slate-400 dark:text-slate-500"
                )}>
                  {item.id === 'run' ? 'รับ-ส่ง' : item.id === 'sort' ? 'คัดแยก' : item.id === 'ext' ? 'นำส่ง' : 'รายงาน'}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="nav-glow"
                    className={cn("absolute -inset-2 blur-xl opacity-10 dark:opacity-20 -z-10", item.bgColor)}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
      <FeedbackButton />
    </div>
  );
};

