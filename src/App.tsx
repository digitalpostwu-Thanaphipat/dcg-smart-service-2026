import { useState, useEffect, useMemo, useRef } from 'react';
import { Truck, Mail, Package, LogOut, Send, Trash2, FileText, Copy, RefreshCw, Loader2, Search, Filter, ArrowLeft, Building2, Bell, X, Sun, Moon, CloudSun, Globe, BarChart3, Wallet, Banknote, Receipt, TrendingUp, Plus } from 'lucide-react';
import { API_URL, APP_NAME } from './config';

// --- Types ---
interface User { UserID: string; Email: string; FullName: string; Role: string; }
interface Department { DeptID: string; DeptName: string; RouteGroup: string; Building?: string; BudgetOwner?: string; }
interface Service { ServiceID: string; ServiceName: string; }
interface LogItem { id: string; timestamp: string; dept: string; desc: string; count: number; cost?: number; type: 'run' | 'sort' | 'ext'; fund?: string; }

// --- Constants ---
const FUND_SOURCES = ["งบประมาณมหาวิทยาลัย", "งบประมาณวิสาหกิจ", "งบประมาณโครงการ"];
const RUN_SAVING_PER_UNIT = 45;

// --- THEME CONFIGURATION ---
const THEMES: any = {
  run: { name: 'รับ-ส่งภายใน', bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-600', light: 'bg-blue-50', hover: 'hover:bg-blue-700', icon: <Truck size={20} /> },
  sort: { name: 'คัดแยก-นำจ่าย', bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500', light: 'bg-orange-50', hover: 'hover:bg-orange-600', icon: <Mail size={20} /> },
  ext: { name: 'นำส่งไปรษณีย์', bg: 'bg-green-600', text: 'text-green-600', border: 'border-green-600', light: 'bg-green-50', hover: 'hover:bg-green-700', icon: <Package size={20} /> },
  report: { name: 'รายงานผล', bg: 'bg-[#6A2C70]', text: 'text-[#6A2C70]', border: 'border-[#6A2C70]', light: 'bg-purple-50', hover: 'hover:bg-purple-800', icon: <FileText size={20} /> },
  default: { name: 'ทั่วไป', bg: 'bg-[#6A2C70]', text: 'text-[#6A2C70]', border: 'border-[#6A2C70]', light: 'bg-purple-50', hover: 'hover:bg-purple-800', icon: <Globe size={20} /> }
};

// --- Helper Components ---
const getDeptDisplay = (dept: Department) => dept.Building ? `${dept.DeptName} (${dept.Building})` : dept.DeptName;

const SmartSearchInput = ({ value, onChange, placeholder, departments, recentDepts, onRecentClick, themeColor }: {
  value: string, onChange: (val: string) => void, placeholder: string, departments?: Department[], recentDepts?: string[], onRecentClick?: (dept: string) => void, themeColor: string
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const filteredDepts = useMemo(() => {
    if (!departments) return [];
    if (!value) return departments.slice(0, 50);
    return departments.filter(d =>
      d.DeptName.toLowerCase().includes(value.toLowerCase()) ||
      (d.Building && d.Building.toLowerCase().includes(value.toLowerCase()))
    ).slice(0, 50);
  }, [departments, value]);

  return (
    <div className="relative" ref={wrapperRef}>
      {recentDepts && recentDepts.length > 0 && onRecentClick && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
          {recentDepts.map(dept => (
            <button key={dept} onClick={() => onRecentClick(dept)} type="button" className={`bg-white border ${themeColor.replace('text-', 'border-')} ${themeColor} text-xs px-2 py-1 rounded-full whitespace-nowrap hover:opacity-80 flex items-center gap-1 shadow-sm transition-colors`}><ArrowLeft size={10} className="rotate-180" /> {dept}</button>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          className={`w-full p-2 border rounded focus:ring-2 outline-none transition-all ${themeColor.replace('text-', 'focus:ring-').replace('600', '400').replace('500', '300')}`}
          placeholder={placeholder}
          value={value}
          onChange={e => { onChange(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onClick={() => setShowSuggestions(true)}
        />
        {value && <button onClick={() => { onChange(''); setShowSuggestions(true); }} className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"><X size={16} /></button>}
      </div>
      {showSuggestions && filteredDepts.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
          {filteredDepts.map(d => (
            <li key={d.DeptID} className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-50 last:border-0" onClick={() => { onChange(getDeptDisplay(d)); setShowSuggestions(false); }}>
              <div className="font-medium text-gray-800">{d.DeptName}</div>
              {d.Building && <div className="text-xs text-gray-400">{d.Building}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const ReceiptModal = ({ data, onClose, userName, onCopy }: { data: any, onClose: () => void, userName: string, onCopy: (text: string) => void }) => {
  if (!data) return null;
  const headerColor = data.type === 'นำส่งไปรษณีย์' ? 'bg-green-600' : 'bg-orange-500';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
        <div className={`${headerColor} p-4 text-white text-center relative`}>
          <h3 className="font-bold text-lg flex justify-center items-center gap-2"><Receipt /> ใบรับฝาก (Receipt)</h3>
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-6 bg-gray-50 text-gray-700 text-sm font-mono">
          <div className="text-center mb-4 border-b pb-4 border-dashed border-gray-300">
            <div className="font-bold text-lg text-gray-800">ส่วนอำนวยการสารบรรณ</div>
            <div className="text-xs text-gray-500">{new Date().toLocaleString('th-TH')}</div>
            <div className="text-xs text-gray-500">Ref: {data.txId}</div>
          </div>
          <div className="space-y-2 mb-4">
            {data.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between">
                <span className="truncate w-2/3">{item.deptName}</span>
                <span className="font-bold">{item.cost ? item.cost + '.-' : (item.itemCount || item.total) + ' ชิ้น'}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-gray-300 pt-3 flex justify-between items-center text-base font-bold">
            <span>รวมทั้งสิ้น</span>
            <span>{data.totalCost > 0 ? data.totalCost + ' บาท' : data.totalCount + ' ชิ้น'}</span>
          </div>
          <div className="mt-6 text-center">
            <div className="text-xs text-gray-400">__________________________</div>
            <div className="text-xs text-gray-500 mt-1">ผู้รับฝาก ({userName})</div>
          </div>
        </div>
        <div className="p-4 bg-white border-t flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-gray-500">ปิด</button>
          <button onClick={() => {
            const text = `ใบรับฝาก\nวันที่: ${new Date().toLocaleString('th-TH')}\nรายการ: ${data.items.length} รายการ\nยอดรวม: ${data.totalCost > 0 ? data.totalCost + ' บาท' : data.totalCount + ' ชิ้น'}`;
            onCopy(text);
          }} className={`flex-1 ${headerColor} text-white py-2 rounded-lg shadow flex justify-center gap-2`}><Copy size={18} /> Copy</button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [loading, setLoading] = useState(true);
  const [masterData, setMasterData] = useState<{ users: User[], departments: Department[], services: Service[] } | null>(null);
  const [sysConfig, setSysConfig] = useState({ announcement: 'แจ้งเตือน: กรุณาบันทึกข้อมูลก่อนเวลา 16.00 น.', show: true });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'run' | 'sort' | 'ext' | 'report'>('run');
  const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  const [showPublicTrack, setShowPublicTrack] = useState(false);
  const [publicSearchDept, setPublicSearchDept] = useState('');
  const [publicResults, setPublicResults] = useState<any[]>([]);
  const [recentDepts, setRecentDepts] = useState<string[]>([]);
  const [receiptData, setReceiptData] = useState<{ type: string, items: any[], totalCost: number, totalCount: number, txId: string } | null>(null);

  const [runChecklist, setRunChecklist] = useState<{ dept: string, count: number, checked: boolean }[]>([]);
  const [runCommon, setRunCommon] = useState({ route: '', round: 'รอบเช้า' });
  const [sortCart, setSortCart] = useState<any[]>([]);
  const [extCart, setExtCart] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [uniqueRoutes, setUniqueRoutes] = useState<string[]>([]);

  const [sortBuilding, setSortBuilding] = useState('');
  const [extBuilding, setExtBuilding] = useState('');
  const [uniqueBuildings, setUniqueBuildings] = useState<string[]>([]);

  const [filters, setFilters] = useState({ dateMode: 'today' as 'today' | 'custom', startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], dept: '', type: 'all' });
  const [showFilters, setShowFilters] = useState(false);
  const [reportView, setReportView] = useState<'list' | 'dashboard'>('list');
  const [dashboardTab, setDashboardTab] = useState<'budget' | 'workload'>('budget');

  const [sortInput, setSortInput] = useState({ dept: '', normal: '', reg: '' });
  const [extInput, setExtInput] = useState({ dept: '', service: '', cost: '', count: '', track: '', fund: '' });

  const theme = THEMES[activeTab] || THEMES.default;

  useEffect(() => {
    fetchMetaData();
    const savedRecents = localStorage.getItem('wus_recent_depts');
    if (savedRecents) setRecentDepts(JSON.parse(savedRecents));
  }, []);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return { text: 'สวัสดีตอนเช้า', icon: <Sun size={16} className="text-yellow-300" /> };
    if (h < 18) return { text: 'สวัสดีตอนบ่าย', icon: <CloudSun size={16} className="text-orange-300" /> };
    return { text: 'สวัสดีตอนเย็น', icon: <Moon size={16} className="text-blue-200" /> };
  };

  const getDeptDisplay = (dept: Department) => dept.Building ? `${dept.DeptName} (${dept.Building})` : dept.DeptName;

  const getRealOwner = (deptName: string) => {
    if (!masterData?.departments) return deptName;
    const dept = masterData.departments.find(d => d.DeptName === deptName);
    return dept?.BudgetOwner || deptName;
  };

  const addToRecent = (deptName: string) => {
    let newRecents = [deptName, ...recentDepts.filter(d => d !== deptName)];
    newRecents = newRecents.slice(0, 5);
    setRecentDepts(newRecents);
    localStorage.setItem('wus_recent_depts', JSON.stringify(newRecents));
  };

  const fetchMetaData = async () => {
    try {
      const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getMetaData' }) });
      const json = await res.json();
      if (json.status === 'success') {
        setMasterData(json.data);
        if (json.data.departments) {
          const routes = [...new Set(json.data.departments.map((d: Department) => d.RouteGroup).filter(Boolean))].sort() as string[];
          setUniqueRoutes(routes);
          const buildings = [...new Set(json.data.departments.map((d: Department) => d.Building).filter(Boolean))].sort() as string[];
          setUniqueBuildings(buildings);
        }
        if (json.data.config && json.data.config.announcement) {
          setSysConfig(json.data.config);
          setShowAnnouncement(json.data.config.show);
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchLogs = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'searchLogs', payload: { filters: filters, email: currentUser.Email } }) });
      const json = await res.json();
      if (json.status === 'success') {
        const list: LogItem[] = [];
        json.data.run.forEach((r: any) => list.push({ id: r.TxID, timestamp: r.Timestamp, dept: r.DeptName, desc: `${r.Route} (${r.Round})`, count: parseInt(r.ItemCount) || 0, type: 'run' }));
        json.data.sort.forEach((r: any) => list.push({ id: r.TxID, timestamp: r.Timestamp, dept: r.DeptName, desc: `ธ: ${r.NormalCount}, ลบ: ${r.RegisterCount}`, count: parseInt(r.Total) || 0, type: 'sort' }));
        json.data.ext.forEach((r: any) => list.push({ id: r.TxID, timestamp: r.Timestamp, dept: r.RequestingDept, desc: `${r.ServiceType} ${r.TrackingNo || ''}`, count: parseInt(r.ItemCount) || 0, cost: parseInt(r.Cost) || 0, type: 'ext', fund: r.FundSource }));
        setLogs(list.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handlePublicSearch = async () => {
    if (!publicSearchDept) return alert('กรุณาเลือกหน่วยงาน');
    setLoading(true);
    try {
      const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'publicSearch', payload: { deptName: publicSearchDept } }) });
      const json = await res.json();
      if (json.status === 'success') {
        setPublicResults(json.data);
        if (json.data.length === 0) alert('ไม่พบข้อมูลการรับ-ส่ง ในช่วง 2 วันนี้');
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleLogin = (email: string) => {
    const user = masterData?.users.find(u => u.Email.toLowerCase() === email.toLowerCase());
    if (user) { setCurrentUser(user); localStorage.setItem('wus_user', JSON.stringify(user)); }
    else alert('ไม่พบผู้ใช้งาน');
  };

  const showStatus = (type: 'success' | 'error', text: string) => { setStatus({ type, text }); setTimeout(() => setStatus(null), 3000); };

  const handleRouteChange = (route: string) => {
    setRunCommon(prev => ({ ...prev, route }));
    if (!masterData) return;
    const depts = masterData.departments.filter(d => d.RouteGroup === route);
    setRunChecklist(depts.map(d => ({ dept: d.DeptName, count: 1, checked: false })));
  };

  const toggleCheck = (index: number) => { const newList = [...runChecklist]; newList[index].checked = !newList[index].checked; setRunChecklist(newList); };
  const updateCount = (index: number, val: string) => { const newList = [...runChecklist]; newList[index].count = parseInt(val) || 0; setRunChecklist(newList); };
  const saveRunBatch = async () => {
    const items = runChecklist.filter(i => i.checked && i.count > 0).map(i => ({ deptName: i.dept, itemCount: i.count }));
    if (items.length === 0) return alert('กรุณาเลือกอย่างน้อย 1 รายการ');
    setLoading(true);
    await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'saveBatch', payload: { type: 'run', items, common: { ...runCommon, staffEmail: currentUser?.Email } } }) });
    setLoading(false); showStatus('success', `บันทึก ${items.length} รายการเรียบร้อย`); handleRouteChange(runCommon.route);
  };

  const addToCart = (type: 'sort' | 'ext') => {
    if (type === 'sort') {
      const total = (parseInt(sortInput.normal) || 0) + (parseInt(sortInput.reg) || 0);
      if (!sortInput.dept || total === 0) return alert('กรุณากรอกข้อมูล');
      setSortCart([...sortCart, { deptName: sortInput.dept, normalCount: sortInput.normal, registerCount: sortInput.reg, total }]);
      setSortInput({ dept: '', normal: '', reg: '' });
      addToRecent(sortInput.dept);
    } else {
      if (!extInput.dept || !extInput.service || !extInput.fund) return alert('กรุณากรอกข้อมูลให้ครบ');
      setExtCart([...extCart, { deptName: extInput.dept, serviceType: extInput.service, cost: extInput.cost, itemCount: extInput.count, trackingNo: extInput.track, fundSource: extInput.fund }]);
      setExtInput({ dept: '', service: '', cost: '', count: '', track: '', fund: '' });
      addToRecent(extInput.dept);
    }
  };

  const saveCart = async (type: 'sort' | 'ext') => {
    const items = type === 'sort' ? sortCart : extCart;
    if (items.length === 0) return;
    setLoading(true);
    const totalCost = items.reduce((sum, i) => sum + (parseInt(i.cost) || 0), 0);
    const totalCount = items.reduce((sum, i) => sum + (parseInt(i.itemCount || i.total) || 0), 0);
    const tempReceipt = { type: type === 'ext' ? 'นำส่งไปรษณีย์' : 'คัดแยก-นำจ่าย', items: [...items], totalCost, totalCount, txId: `TX-${Date.now().toString().slice(-6)}` };
    await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'saveBatch', payload: { type, items, common: { staffEmail: currentUser?.Email } } }) });
    setLoading(false); showStatus('success', 'บันทึกเรียบร้อย');
    if (type === 'sort') setSortCart([]); else setExtCart([]);
    setReceiptData(tempReceipt);
  };

  const copyReport = () => {
    const runStats = logs.filter(l => l.type === 'run');
    const sortStats = logs.filter(l => l.type === 'sort');
    const extStats = logs.filter(l => l.type === 'ext');
    const unique = (arr: LogItem[]) => new Set(arr.map(i => getRealOwner(i.dept))).size;
    const sum = (arr: LogItem[]) => arr.reduce((acc, curr) => acc + (parseInt(curr.count as any) || 0), 0);
    const sumCost = (arr: LogItem[]) => arr.reduce((acc, curr) => acc + (parseInt(curr.cost as any) || 0), 0);
    const text = `สรุปงานประจำวัน ${filters.dateMode === 'today' ? '(วันนี้)' : ''}\n\nคัดแยก-นำจ่ายไปรษณีย์ภัณฑ์ (ภายใน):\n- สำเร็จ ${unique(sortStats)} หน่วยงาน (${sum(sortStats)} ฉบับ)\n\nนำส่งไปรษณีย์ภัณฑ์ (ภายนอก):\n- สำเร็จ ${unique(extStats)} หน่วยงาน (${sum(extStats)} ชิ้น)\n- งบประมาณ ${sumCost(extStats)} บาท\n\nรับ-ส่ง เอกสารภายใน (Run):\n- สำเร็จ ${unique(runStats)} หน่วยงาน (${sum(runStats)} ซอง)`;
    navigator.clipboard.writeText(text); showStatus('success', 'คัดลอกรายงานแล้ว');
  };

  const deleteLog = async (id: string, type: string) => { if (!confirm('ยืนยันลบ?')) return; setLoading(true); await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteLog', payload: { id, type } }) }); await fetchLogs(); setLoading(false); };
  const filterServices = () => masterData?.services.filter(s => !s.ServiceName.toLowerCase().includes('flash') && !s.ServiceName.toLowerCase().includes('kerry') && !s.ServiceName.includes('เอกชน'));

  const dashboardStats = useMemo(() => {
    const extLogs = logs.filter(l => l.type === 'ext' && l.fund === 'งบประมาณมหาวิทยาลัย');
    const totalCost = extLogs.reduce((sum, item) => sum + (item.cost || 0), 0);
    const costByDept: Record<string, number> = {};
    extLogs.forEach(item => { const owner = getRealOwner(item.dept); costByDept[owner] = (costByDept[owner] || 0) + (item.cost || 0); });
    const topCost = Object.entries(costByDept).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const allLogs = logs;
    const totalItems = allLogs.reduce((sum, item) => sum + (item.count || 0), 0);
    const countByDept: Record<string, number> = {};
    allLogs.forEach(item => { const owner = getRealOwner(item.dept); countByDept[owner] = (countByDept[owner] || 0) + (item.count || 0); });
    const topCount = Object.entries(countByDept).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { totalCost, topCost, totalItems, topCount };
  }, [logs, masterData]);

  const listStats = useMemo(() => {
    const transactions = logs.length;
    const items = logs.reduce((sum, l) => sum + (parseInt(l.count as any) || 0), 0);

    const costExt = logs.filter(l => l.type === 'ext').reduce((sum, l) => sum + (parseInt(l.cost as any) || 0), 0);
    const countRun = logs.filter(l => l.type === 'run').reduce((sum, l) => sum + (parseInt(l.count as any) || 0), 0);
    const savingRun = countRun * RUN_SAVING_PER_UNIT;

    let statLabel = "งบประมาณรวม";
    let statValue = `฿${costExt.toLocaleString()}`;
    let showMoney = true;

    if (filters.type === 'run') {
      statLabel = `มูลค่าบริการ (${RUN_SAVING_PER_UNIT}บ./ชิ้น)`;
      statValue = `฿${savingRun.toLocaleString()}`;
    } else if (filters.type === 'sort') {
      showMoney = false;
    } else {
      statLabel = "งบประมาณรวม";
      statValue = `฿${costExt.toLocaleString()}`;
    }

    const uniqueDepts = new Set(logs.map(l => getRealOwner(l.dept))).size;
    return { transactions, uniqueDepts, items, statLabel, statValue, showMoney };
  }, [logs, masterData, filters.type]);

  const getFilteredDepartments = (building: string) => {
    if (!masterData?.departments) return [];
    if (!building) return masterData.departments;
    return masterData.departments.filter(d => d.Building === building);
  };

  if (!currentUser) return (
    <div className="flex h-screen items-center justify-center bg-gray-100 p-4 font-sans"><div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center"><h1 className="text-2xl font-bold text-[#6A2C70] mb-2">{APP_NAME}</h1><p className="text-gray-500 mb-6 text-sm">ระบบบริหารงานไปรษณีย์ ส่วนอำนวยการสารบรรณ</p>{!showPublicTrack ? (<form onSubmit={(e) => { e.preventDefault(); handleLogin((e.target as any).email.value); }}><input name="email" required placeholder="Email พนักงาน (@wu.ac.th)" className="w-full p-3 border rounded mb-4 focus:ring-2 focus:ring-[#6A2C70] outline-none" /><button className="w-full bg-[#6A2C70] text-white py-3 rounded font-bold shadow-lg hover:bg-purple-800 transition">เข้าสู่ระบบ</button><div className="mt-4 pt-4 border-t"><button type="button" onClick={() => setShowPublicTrack(true)} className="text-[#6A2C70] text-sm font-medium flex items-center justify-center gap-2 w-full p-2 hover:bg-gray-50 rounded"><Globe size={16} /> ตรวจสอบสถานะ (บุคคลทั่วไป)</button></div></form>) : (<div className="animate-in slide-in-from-right duration-300"><h3 className="font-bold text-lg mb-4 text-left">🔍 ตรวจสอบสถานะพัสดุ</h3><div className="mb-4 text-left"><label className="text-sm text-gray-600 mb-1 block">หน่วยงานของท่าน</label><SmartSearchInput value={publicSearchDept} onChange={setPublicSearchDept} placeholder="พิมพ์ชื่อหน่วยงาน..." themeColor="text-[#6A2C70]" departments={masterData?.departments} /></div><button onClick={handlePublicSearch} className="w-full bg-secondary text-white py-3 rounded font-bold shadow mb-3 flex justify-center items-center gap-2"><Search size={18} /> ค้นหา</button><button onClick={() => setShowPublicTrack(false)} className="text-gray-500 text-sm">กลับหน้าเข้าสู่ระบบ</button>{publicResults.length > 0 && (<div className="mt-4 text-left max-h-60 overflow-y-auto border-t pt-2 space-y-2">{publicResults.map((res, idx) => (<div key={idx} className="bg-gray-50 p-2 rounded border text-sm"><div className="font-bold text-gray-800">{res.desc}</div><div className="flex justify-between text-xs text-gray-500 mt-1"><span>{res.date}</span><span className="text-green-600 font-bold">{res.status}</span></div></div>))}</div>)}</div>)}</div></div>
  );

  const greeting = getGreeting();

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-800 transition-colors duration-300">
      <header className={`${theme.bg} text-white p-4 sticky top-0 z-20 shadow-md transition-colors duration-300`}><div className="flex justify-between items-center"><div><div className="flex items-center gap-2 text-xs font-medium text-white/90">{greeting.icon} {greeting.text}</div><h1 className="font-bold text-lg">{currentUser.FullName}</h1></div><button onClick={() => { setCurrentUser(null); localStorage.removeItem('wus_user'); }} className="opacity-80 hover:opacity-100"><LogOut size={20} /></button></div></header>
      {showAnnouncement && sysConfig.announcement && <div className="bg-yellow-100 border-b border-yellow-200 p-3 flex items-start gap-3 text-sm text-yellow-800 animate-in slide-in-from-top duration-300"><Bell size={18} className="shrink-0 mt-0.5 text-yellow-600" /><div className="flex-1">{sysConfig.announcement}</div><button onClick={() => setShowAnnouncement(false)} className="text-yellow-600"><X size={16} /></button></div>}
      {status && <div className={`fixed top-16 w-full p-3 text-center z-30 ${status.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white shadow`}>{status.text}</div>}
      {loading && <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-white w-12 h-12" /></div>}

      <main className="p-4 max-w-xl mx-auto pb-60">
        <div className={`flex items-center gap-2 mb-4 font-bold text-lg ${theme.text}`}>{theme.icon} <span>{theme.name}</span></div>

        {activeTab === 'run' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100"><div className="grid grid-cols-2 gap-2"><select className={`p-2 border rounded-lg focus:ring-2 outline-none ${theme.text.replace('text-', 'focus:ring-').replace('600', '400')}`} value={runCommon.route} onChange={e => handleRouteChange(e.target.value)}><option value="">-- เลือกสาย --</option>{uniqueRoutes.map(r => <option key={r} value={r}>{r}</option>)}</select><div className="flex bg-gray-100 rounded-lg p-1">{['รอบเช้า', 'รอบบ่าย'].map(r => <button key={r} onClick={() => setRunCommon(p => ({ ...p, round: r }))} className={`flex-1 text-sm rounded-md transition-all ${runCommon.round === r ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500'}`}>{r}</button>)}</div></div></div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">{runChecklist.length === 0 ? <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2"><Truck size={40} className="opacity-20" /><span>เลือกสายเพื่อเริ่มงาน</span></div> : runChecklist.map((item, idx) => (<div key={idx} className={`flex items-center p-3 gap-3 transition-colors ${item.checked ? theme.light : 'hover:bg-gray-50'}`}><input type="checkbox" className={`w-6 h-6 accent-blue-600 cursor-pointer`} checked={item.checked} onChange={() => toggleCheck(idx)} /><div className="flex-1 text-sm font-medium cursor-pointer" onClick={() => toggleCheck(idx)}>{item.dept}</div>{item.checked && <input type="number" className={`w-16 p-1 border rounded text-center font-bold bg-white ${theme.text}`} value={item.count} onChange={e => updateCount(idx, e.target.value)} />}</div>))}</div>
            {runChecklist.some(i => i.checked) && <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-30 rounded-t-2xl"><div className="max-w-xl mx-auto"><div className="flex justify-between items-center mb-2"><strong className={`${theme.text} text-sm`}>รายการที่จะบันทึก:</strong><span className={`bg-gray-100 ${theme.text} text-xs font-bold px-2 py-1 rounded-full`}>รวม {runChecklist.reduce((s, i) => i.checked ? s + (i.count || 0) : s, 0)} ชิ้น</span></div><div className="bg-gray-50 p-2 rounded-lg mb-3 max-h-32 overflow-y-auto text-xs border border-gray-200"><ul className="list-none space-y-1 text-gray-700">{runChecklist.filter(i => i.checked && i.count > 0).map((i, idx) => <li key={idx} className="flex justify-between border-b border-gray-200 pb-1 last:border-0"><span>{i.dept}</span><span className="font-bold ml-2 whitespace-nowrap">จำนวน {i.count} ซอง</span></li>)}</ul></div><button onClick={saveRunBatch} className={`w-full ${theme.bg} text-white py-3.5 rounded-xl shadow-lg font-bold flex justify-center items-center gap-2 ${theme.hover} transition-transform active:scale-95`}><Send size={18} /> ยืนยันบันทึก ({runChecklist.filter(i => i.checked).length} รายการ)</button></div></div>}
          </div>
        )}

        {activeTab === 'sort' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
              <select className="w-full p-2 border rounded text-sm text-gray-600 bg-gray-50" value={sortBuilding} onChange={e => setSortBuilding(e.target.value)}><option value="">🏢 แสดงทุกอาคาร</option>{uniqueBuildings.map(b => <option key={b} value={b}>{b}</option>)}</select>
              <label className="text-xs font-bold text-gray-500">หน่วยงาน (พิมพ์เพื่อค้นหา)</label>
              <SmartSearchInput
                value={sortInput.dept}
                onChange={(v) => setSortInput({ ...sortInput, dept: v })}
                placeholder="เช่น สำนักวิชา..."
                themeColor={theme.text}
                recentDepts={recentDepts}
                onRecentClick={(d) => setSortInput({ ...sortInput, dept: d })}
                departments={getFilteredDepartments(sortBuilding)}
              />
              <div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] text-gray-400 block mb-1">ธรรมดา</label><input type="number" placeholder="0" className="w-full p-2 border rounded-lg text-center" value={sortInput.normal} onChange={e => setSortInput({ ...sortInput, normal: e.target.value })} /></div><div><label className="text-[10px] text-gray-400 block mb-1">ลงทะเบียน</label><input type="number" placeholder="0" className="w-full p-2 border rounded-lg text-center" value={sortInput.reg} onChange={e => setSortInput({ ...sortInput, reg: e.target.value })} /></div></div><button onClick={() => addToCart('sort')} className={`w-full ${theme.bg} text-white py-3 rounded-xl font-bold shadow-md ${theme.hover} transition flex justify-center items-center gap-2`}><Plus size={18} /> เพิ่มรายการ</button></div>
            {sortCart.length > 0 && <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"><h3 className={`font-bold mb-2 flex justify-between ${theme.text}`}>ตะกร้าคัดแยก <span>{sortCart.length}</span></h3><div className={`bg-orange-50 p-3 rounded-lg mb-3 text-xs border ${theme.border.replace('border-', 'border-opacity-20 ')}`}><div className="flex justify-between mb-1"><strong className="text-orange-800">ตรวจสอบรายการ:</strong><span className="text-orange-800 font-bold">รวม {sortCart.reduce((sum, i) => sum + i.total, 0)} ชิ้น</span></div><ul className="list-disc pl-4 space-y-1 text-orange-700">{sortCart.map((item, idx) => <li key={idx}>{item.deptName} <span className="font-bold">({item.total} ฉบับ)</span></li>)}</ul></div><button onClick={() => saveCart('sort')} className={`w-full ${theme.bg} text-white py-3 rounded-xl font-bold shadow-lg ${theme.hover} flex justify-center gap-2`}><Send size={18} /> ยืนยันบันทึก</button><div className="mt-4 space-y-2 border-t pt-2">{sortCart.map((item, idx) => <div key={idx} className="flex justify-between items-center text-sm text-gray-600"><span>{item.deptName}</span><div className="flex gap-2"><span className="font-bold">{item.total}</span><button onClick={() => setSortCart(sortCart.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></div></div>)}</div></div>}
          </div>
        )}

        {activeTab === 'ext' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
              <select className="w-full p-2 border rounded text-sm text-gray-600 bg-gray-50" value={extBuilding} onChange={e => setExtBuilding(e.target.value)}><option value="">🏢 แสดงทุกอาคาร</option>{uniqueBuildings.map(b => <option key={b} value={b}>{b}</option>)}</select>
              <label className="text-xs font-bold text-gray-500">หน่วยงาน (พิมพ์เพื่อค้นหา)</label>
              <SmartSearchInput
                value={extInput.dept}
                onChange={(v) => setExtInput({ ...extInput, dept: v })}
                placeholder="เช่น สำนักวิชา..."
                themeColor={theme.text}
                recentDepts={recentDepts}
                onRecentClick={(d) => setExtInput({ ...extInput, dept: d })}
                departments={getFilteredDepartments(extBuilding)}
              />
              <select className="w-full p-2.5 border rounded-lg bg-white" value={extInput.service} onChange={e => setExtInput({ ...extInput, service: e.target.value })}><option value="">-- ประเภทบริการ --</option>{filterServices()?.map(s => <option key={s.ServiceID} value={s.ServiceName}>{s.ServiceName}</option>)}</select><select className="w-full p-2.5 border rounded-lg bg-white" value={extInput.fund} onChange={e => setExtInput({ ...extInput, fund: e.target.value })}><option value="">-- แหล่งงบประมาณ --</option>{FUND_SOURCES.map(f => <option key={f} value={f}>{f}</option>)}</select><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] text-gray-400 block mb-1">ราคา (บาท)</label><input type="number" placeholder="0.00" className="w-full p-2 border rounded-lg" value={extInput.cost} onChange={e => setExtInput({ ...extInput, cost: e.target.value })} /></div><div><label className="text-[10px] text-gray-400 block mb-1">จำนวน (ชิ้น)</label><input type="number" placeholder="1" className="w-full p-2 border rounded-lg" value={extInput.count} onChange={e => setExtInput({ ...extInput, count: e.target.value })} /></div></div><input type="text" placeholder="Tracking No. (ถ้ามี)" className="w-full p-2.5 border rounded-lg uppercase" value={extInput.track} onChange={e => setExtInput({ ...extInput, track: e.target.value })} /><button onClick={() => addToCart('ext')} className={`w-full ${theme.bg} text-white py-3 rounded-xl font-bold shadow-md ${theme.hover} transition flex justify-center items-center gap-2`}><Plus size={18} /> เพิ่มรายการ</button></div>
            {extCart.length > 0 && <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"><h3 className={`font-bold mb-2 flex justify-between ${theme.text}`}>ตะกร้านำส่ง <span>{extCart.length}</span></h3><div className={`bg-green-50 p-3 rounded-lg mb-3 text-xs border ${theme.border.replace('border-', 'border-opacity-20 ')}`}><div className="flex justify-between mb-1"><strong className="text-green-800">ตรวจสอบรายการ:</strong><span className="text-green-800 font-bold text-xs">รวม {extCart.reduce((sum, i) => sum + (parseInt(i.cost) || 0), 0)} บาท</span></div><ul className="list-disc pl-4 space-y-1 text-green-700">{extCart.map((item, idx) => <li key={idx}>{item.deptName} <span className="font-bold">({item.cost} บาท)</span></li>)}</ul></div><button onClick={() => saveCart('ext')} className={`w-full ${theme.bg} text-white py-3 rounded-xl font-bold shadow-lg ${theme.hover} flex justify-center gap-2`}><Send size={18} /> ยืนยันบันทึก (ตัดงบ)</button><div className="mt-4 space-y-2 border-t pt-2">{extCart.map((item, idx) => <div key={idx} className="flex justify-between items-center text-sm text-gray-600"><span className="truncate w-1/2">{item.deptName}</span><div className="flex gap-2 items-center"><span className="font-bold">{item.cost} บ.</span><button onClick={() => setExtCart(extCart.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></div></div>)}</div></div>}
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-3"><div className="flex gap-2"><button onClick={() => setReportView('list')} className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${reportView === 'list' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}>📜 ประวัติ</button><button onClick={() => setReportView('dashboard')} className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${reportView === 'dashboard' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}>📊 สถิติ</button></div><button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-full ${showFilters ? 'bg-gray-200' : 'hover:bg-gray-100'}`}><Filter size={18} className="text-gray-600" /></button></div>
              {showFilters && (<div className="bg-gray-50 p-3 rounded-lg mb-3 text-sm space-y-2 border border-gray-200"><div className="flex gap-2"><button onClick={() => setFilters({ ...filters, dateMode: 'today' })} className={`flex-1 py-1.5 rounded-md border transition-colors ${filters.dateMode === 'today' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-gray-300 text-gray-600'}`}>วันนี้</button><button onClick={() => setFilters({ ...filters, dateMode: 'custom' })} className={`flex-1 py-1.5 rounded-md border transition-colors ${filters.dateMode === 'custom' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-gray-300 text-gray-600'}`}>กำหนดเอง</button></div>{filters.dateMode === 'custom' && (<div className="grid grid-cols-2 gap-2"><input type="date" className="p-1.5 border rounded bg-white" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} /><input type="date" className="p-1.5 border rounded bg-white" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} /></div>)}<select className="w-full p-2 border rounded bg-white" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}><option value="all">(ทุกประเภทงาน)</option><option value="run">รับ-ส่ง เอกสารภายใน</option><option value="sort">คัดแยก-นำจ่ายฯ</option><option value="ext">นำส่งไปรษณีย์ฯ</option></select><select className="w-full p-2 border rounded bg-white" value={filters.dept} onChange={e => setFilters({ ...filters, dept: e.target.value })}><option value="">(ทุกหน่วยงาน)</option>{masterData?.departments.map(d => <option key={d.DeptID} value={getDeptDisplay(d)}>{getDeptDisplay(d)}</option>)}</select><button onClick={fetchLogs} className="w-full bg-gray-800 text-white py-2 rounded-lg flex justify-center gap-2 hover:bg-gray-900 transition"><Search size={16} /> ค้นหาข้อมูล</button></div>)}
              {reportView === 'list' && (<div className="flex gap-2"><button onClick={fetchLogs} className="flex-1 bg-white border border-gray-300 py-2 rounded-lg flex justify-center gap-2 hover:bg-gray-50 transition"><RefreshCw size={18} /> โหลดข้อมูล</button><button onClick={copyReport} className="flex-1 bg-green-600 text-white py-2 rounded-lg flex justify-center gap-2 font-bold shadow-sm hover:bg-green-700 transition"><Copy size={18} /> Copy สรุปไลน์</button></div>)}
            </div>

            {reportView === 'list' && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-blue-100 flex flex-col items-center justify-center"><div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><FileText size={12} /> รายการ</div><div className="font-bold text-xl text-blue-600">{listStats.transactions}</div></div>
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-purple-100 flex flex-col items-center justify-center"><div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Building2 size={12} /> หน่วยงาน</div><div className="font-bold text-xl text-purple-600">{listStats.uniqueDepts}</div></div>
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-green-100 flex flex-col items-center justify-center"><div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Package size={12} /> ชิ้นรวม</div><div className="font-bold text-xl text-green-600">{listStats.items}</div></div>
                  {listStats.showMoney && (<div className="bg-white p-3 rounded-xl shadow-sm border border-orange-100 flex flex-col items-center justify-center text-center"><div className="text-[10px] text-gray-500 mb-1 flex items-center justify-center gap-1 whitespace-nowrap">{listStats.statLabel === 'งบประมาณรวม' ? <Banknote size={12} /> : <TrendingUp size={12} />} {listStats.statLabel}</div><div className="font-bold text-lg text-orange-600">{listStats.statValue}</div></div>)}
                </div>
                <div className="space-y-3">
                  {logs.length === 0 ? <div className="text-center py-12 text-gray-400 flex flex-col items-center gap-2"><FileText size={40} className="opacity-20" /><span>ไม่พบข้อมูล</span></div> : logs.map(log => (
                    <div key={log.id} className={`bg-white p-3 rounded-xl shadow-sm border-l-4 flex justify-between items-start transition-all hover:shadow-md ${log.type === 'run' ? 'border-blue-500' : log.type === 'sort' ? 'border-orange-500' : 'border-green-500'}`}>
                      <div className="flex items-start overflow-hidden">
                        <div className="mr-3 mt-1 bg-gray-50 p-2 rounded-lg">{log.type === 'run' && <Truck size={18} className="text-blue-500" />}{log.type === 'sort' && <Mail size={18} className="text-orange-500" />}{log.type === 'ext' && <Package size={18} className="text-green-500" />}</div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-gray-800 truncate">{log.dept}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{(log.timestamp && log.timestamp.includes(' ')) ? log.timestamp.split(' ')[1].slice(0, 5) : ''} น. | {log.desc}</div>
                          <div className="text-xs font-bold mt-1.5 flex flex-wrap gap-2 items-center"><span className={`${log.type === 'run' ? 'text-blue-700 bg-blue-50 border-blue-100' : log.type === 'sort' ? 'text-orange-700 bg-orange-50 border-orange-100' : 'text-green-700 bg-green-50 border-green-100'} px-2 py-0.5 rounded border text-[10px]`}>{log.type === 'run' ? 'รับ-ส่ง' : log.type === 'sort' ? 'คัดแยก' : 'นำส่ง'}</span><span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-[10px]">{log.count} ชิ้น</span>{log.type === 'ext' && log.cost && <span className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded text-[10px] font-bold">฿{log.cost}</span>}{log.type === 'run' && <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-[10px] flex items-center gap-1"><TrendingUp size={8} /> มูลค่า {log.count * RUN_SAVING_PER_UNIT}.-</span>}</div>
                        </div>
                      </div>
                      <button onClick={() => deleteLog(log.id, log.type)} className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reportView === 'dashboard' && (
              <div className="space-y-4 animate-in fade-in zoom-in duration-300">{(() => { const stats = dashboardStats; return (<><div className="flex bg-gray-100 p-1 rounded-xl mb-2"><button onClick={() => setDashboardTab('budget')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${dashboardTab === 'budget' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}><Wallet size={14} /> สรุปงบฯ</button><button onClick={() => setDashboardTab('workload')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${dashboardTab === 'workload' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}><BarChart3 size={14} /> ปริมาณงาน</button></div>{dashboardTab === 'budget' && (<><div className="bg-gradient-to-br from-[#6A2C70] to-purple-900 text-white p-6 rounded-2xl shadow-lg text-center relative overflow-hidden"><div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div><div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full -ml-8 -mb-8"></div><p className="opacity-90 text-sm mb-2 font-medium">ยอดรวมค่าใช้จ่าย (งบฯ มหาวิทยาลัย)</p><h2 className="text-4xl font-bold tracking-tight">฿{stats.totalCost.toLocaleString()}</h2><p className="text-[10px] mt-2 bg-white/20 inline-block px-2 py-0.5 rounded-full backdrop-blur-sm">ช่วงวันที่เลือก</p></div><div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100"><h3 className="font-bold text-gray-700 mb-4 border-b pb-2 flex gap-2 items-center text-sm"><Building2 size={16} className="text-primary" /> Top 5 หน่วยงานใช้งบฯ สูงสุด</h3><div className="space-y-3">{stats.topCost.map(([dept, cost], idx) => (<div key={dept} className="flex items-center gap-3 text-sm"><div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'}`}>{idx + 1}</div><div className="flex-1 truncate text-gray-700">{dept}</div><div className="font-bold text-primary">฿{cost.toLocaleString()}</div></div>))}</div></div></>)}{dashboardTab === 'workload' && (<><div className="bg-gradient-to-br from-blue-600 to-blue-900 text-white p-6 rounded-2xl shadow-lg text-center relative overflow-hidden"><div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div><div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full -ml-8 -mb-8"></div><p className="opacity-90 text-sm mb-2 font-medium">ปริมาณงานรวม (ทุกประเภท)</p><h2 className="text-4xl font-bold tracking-tight">{stats.totalItems.toLocaleString()} <span className="text-lg font-normal opacity-80">ชิ้น</span></h2><p className="text-[10px] mt-2 bg-white/20 inline-block px-2 py-0.5 rounded-full backdrop-blur-sm">ช่วงวันที่เลือก</p></div><div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100"><h3 className="font-bold text-gray-700 mb-4 border-b pb-2 flex gap-2 items-center text-sm"><Truck size={16} className="text-blue-600" /> Top 5 หน่วยงานที่มีงานเยอะสุด</h3><div className="space-y-3">{stats.topCount.map(([dept, count], idx) => (<div key={dept} className="flex items-center gap-3 text-sm"><div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-blue-100 text-blue-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : idx === 2 ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-50 text-gray-400'}`}>{idx + 1}</div><div className="flex-1 truncate text-gray-700">{dept}</div><div className="font-bold text-blue-600">{count.toLocaleString()} ชิ้น</div></div>))}</div></div></>)}</>); })()}</div>
            )}
          </div>
        )}
      </main>
      <div className="fixed bottom-0 left-0 w-full bg-white shadow-2xl border-t flex justify-around py-2 z-20">
        <button onClick={() => setActiveTab('run')} className={`flex flex-col items-center p-2 text-xs ${activeTab === 'run' ? 'text-primary font-bold' : 'text-gray-400'}`}><Truck size={24} /> รับ-ส่ง</button>
        <button onClick={() => setActiveTab('sort')} className={`flex flex-col items-center p-2 text-xs ${activeTab === 'sort' ? 'text-primary font-bold' : 'text-gray-400'}`}><Mail size={24} /> คัดแยก</button>
        <button onClick={() => setActiveTab('ext')} className={`flex flex-col items-center p-2 text-xs ${activeTab === 'ext' ? 'text-primary font-bold' : 'text-gray-400'}`}><Package size={24} /> นำส่ง</button>
        <button onClick={() => { setActiveTab('report'); fetchLogs(); }} className={`flex flex-col items-center p-2 text-xs ${activeTab === 'report' ? 'text-primary font-bold' : 'text-gray-400'}`}><FileText size={24} /> รายงาน</button>
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        data={receiptData}
        onClose={() => setReceiptData(null)}
        userName={currentUser?.FullName.split(' ')[0] || ''}
        onCopy={(text) => { navigator.clipboard.writeText(text); showStatus('success', 'คัดลอกข้อมูลแล้ว'); }}
      />
    </div>
  );
}
export default App;