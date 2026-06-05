import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../services/api';
import { Search, MapPin, Inbox, Globe, ArrowLeft, Link } from 'lucide-react';
import { toast } from 'sonner';
import SmartSearchInput from '../common/SmartSearchInput';

interface PublicTrackViewProps {
  onBack: () => void;
  initialDept?: string;
}

type ServiceTab = 'run' | 'sort' | 'ext';

const formatDateLocal = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const PublicTrackView: React.FC<PublicTrackViewProps> = ({ onBack, initialDept }) => {
  const { masterData, setLoading } = useAppStore();
  const [publicSearchDept, setPublicSearchDept] = useState('');
  const [activeTab, setActiveTab] = useState<ServiceTab>('run');
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  const [publicStartDate, setPublicStartDate] = useState(
    formatDateLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [publicEndDate, setPublicEndDate] = useState(
    formatDateLocal(new Date())
  );

  const todayStr = formatDateLocal(new Date());
  const now = new Date();
  const firstDayStr = formatDateLocal(new Date(now.getFullYear(), now.getMonth(), 1));
  const currentMonth = now.getMonth();
  const fiscalYear = currentMonth >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  const fiscalYearStartStr = `${fiscalYear}-10-01`;
  const fiscalYearEndStr = `${fiscalYear + 1}-09-30`;

  const isToday = publicStartDate === todayStr && publicEndDate === todayStr;
  const isMonth = publicStartDate === firstDayStr && publicEndDate === todayStr;
  const isFiscal = publicStartDate === fiscalYearStartStr && publicEndDate === fiscalYearEndStr;

  const setPresetToday = () => {
    setPublicStartDate(todayStr);
    setPublicEndDate(todayStr);
  };

  const setPresetMonth = () => {
    setPublicStartDate(firstDayStr);
    setPublicEndDate(todayStr);
  };

  const setPresetFiscal = () => {
    setPublicStartDate(fiscalYearStartStr);
    setPublicEndDate(fiscalYearEndStr);
  };
  
  const handleCopyLink = () => {
    if (!publicSearchDept) return;
    const url = `${window.location.origin}${window.location.pathname}?view=public&dept=${encodeURIComponent(publicSearchDept)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const parseDateStr = (dateStr: string) => {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return new Date(dateStr);
  };

  const filterByDateRange = (items: any[]) => {
    return items.filter(item => {
      const parsedDate = parseDateStr(item.date);
      const y = parsedDate.getFullYear();
      const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const d = String(parsedDate.getDate()).padStart(2, '0');
      const itemDateStr = `${y}-${m}-${d}`;
      
      if (publicStartDate && itemDateStr < publicStartDate) return false;
      if (publicEndDate && itemDateStr > publicEndDate) return false;
      
      return true;
    });
  };
  
  // Categorized state
  const [runData, setRunData] = useState<any[]>([]);
  const [sortData, setSortData] = useState<any[]>([]);
  const [extData, setExtData] = useState<any[]>([]);

  const performSearch = async (dept: string) => {
    if (!dept) return;
    setLoading(true);
    setHasSearched(false);
    
    try {
      const json = await api.publicSearch(dept);
      if (json.status === 'success') {
        const rawData = json.data;
        
        // Check if API returned structured data or flat list
        if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
          // Structured response (New version)
          setRunData(rawData.run || []);
          setSortData(rawData.sort || []);
          setExtData(rawData.ext || []);
        } else if (Array.isArray(rawData)) {
          // Flat list response (Old version) - categorize dynamically
          const runItems: any[] = [];
          const sortItems: any[] = [];
          const extItems: any[] = [];
          
          rawData.forEach((item: any) => {
            const desc = String(item.desc || '').toLowerCase();
            if (desc.includes('รับไปรษณีย์') || desc.includes('รับพัสดุ') || desc.includes('ภายใน') || desc.includes('run')) {
              runItems.push({
                date: item.date,
                route: item.route || 'สายส่งภายใน',
                round: item.round || 'รอบทั่วไป',
                count: item.count || '1',
                note: item.note || item.desc
              });
            } else if (desc.includes('คัดแยก') || desc.includes('sort') || desc.includes('ธรรมดา') || desc.includes('ลงทะเบียน') || desc.includes('ส่วนตัว')) {
              sortItems.push({
                date: item.date,
                normal: item.normalCount || item.normal || '0',
                register: item.registerCount || item.register || '0',
                private: item.privateCount || item.private || '0',
                total: item.total || '0',
                note: item.desc
              });
            } else {
              extItems.push({
                date: item.date,
                service: item.service || 'ไปรษณีย์ไทย/เอกชน',
                cost: item.cost || '0',
                count: item.count || '1',
                tracking: item.tracking || '-',
                fund: item.fund || 'งบประมาณหน่วยงาน'
              });
            }
          });
          
          setRunData(runItems);
          setSortData(sortItems);
          setExtData(extItems);
        }
        setHasSearched(true);
      } else {
        toast.error('เกิดข้อผิดพลาด', {
          description: json.message || 'ไม่สามารถดึงข้อมูลได้',
        });
      }
    } catch (e: any) {
      console.error(e);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ', {
        description: String(e.message || e),
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePublicSearch = () => {
    if (!publicSearchDept) { toast.warning('กรุณาเลือกหน่วยงานของท่าน'); return; }
    performSearch(publicSearchDept);
  };

  React.useEffect(() => {
    if (initialDept) {
      const decodedDept = decodeURIComponent(initialDept);
      setPublicSearchDept(decodedDept);
      performSearch(decodedDept);
    }
  }, [initialDept]);

  return (
    <div className="animate-in fade-in slide-in-from-right duration-300 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
        <h3 className="font-extrabold text-lg text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
          ตรวจสอบการใช้บริการ
        </h3>
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none"
          title="กลับหน้าเข้าสู่ระบบ"
          aria-label="กลับหน้าเข้าสู่ระบบ"
        >
          <ArrowLeft size={16} />
        </button>
      </div>

      <div className="text-left space-y-2">
        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest block">
          หน่วยงานของท่าน
        </label>
        <div className="flex gap-2">
          <div className="flex-1">
            <SmartSearchInput
              value={publicSearchDept}
              onChange={setPublicSearchDept}
              placeholder="พิมพ์ชื่อหน่วยงานของท่าน..."
              departments={masterData?.departments || []}
              themeColor="text-purple-500"
            />
          </div>
          <button
            onClick={handlePublicSearch}
            className="px-5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md shadow-purple-950/10 dark:shadow-none flex items-center gap-2 transition-all active:scale-95 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none"
          >
            <Search size={16} /> ค้นหา
          </button>
        </div>
        {hasSearched && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/40 dark:hover:bg-slate-700/60 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 rounded-xl text-[10px] font-bold border border-slate-200 dark:border-white/5 transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none"
            >
              <Link size={12} />
              {copiedLink ? 'คัดลอกลิงก์แล้ว!' : 'คัดลอกลิงก์ตรวจสอบสำหรับหน่วยงานนี้'}
            </button>
          </div>
        )}
      </div>

      {hasSearched && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-350">
          {/* Date Range Calendar Selector */}
          <div className="space-y-1.5 text-left bg-slate-100 dark:bg-slate-950/20 p-3.5 rounded-2xl border border-slate-200 dark:border-white/5">
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest block mb-1">
              ช่วงเวลาที่ต้องการตรวจสอบ
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-600 dark:text-slate-400 font-semibold">จากวันที่</span>
                <input
                  type="date"
                  value={publicStartDate}
                  onChange={(e) => setPublicStartDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-purple-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none transition-shadow"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-slate-600 dark:text-slate-400 font-semibold">ถึงวันที่</span>
                <input
                  type="date"
                  value={publicEndDate}
                  onChange={(e) => setPublicEndDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-purple-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none transition-shadow"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-slate-200 dark:border-white/5">
              <button
                onClick={setPresetToday}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none ${
                  isToday
                    ? 'bg-purple-600 dark:bg-purple-500 text-white shadow-sm'
                    : 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                }`}
              >
                วันนี้
              </button>
              <button
                onClick={setPresetMonth}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none ${
                  isMonth
                    ? 'bg-purple-600 dark:bg-purple-500 text-white shadow-sm'
                    : 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                }`}
              >
                เดือนนี้
              </button>
              <button
                onClick={setPresetFiscal}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none ${
                  isFiscal
                    ? 'bg-purple-600 dark:bg-purple-500 text-white shadow-sm'
                    : 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                }`}
              >
                ปีงบประมาณ
              </button>
            </div>
          </div>

          {/* Service Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-950/40 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5" role="tablist" aria-label="ประเภทงานบริการไปรษณีย์">
            <button
              onClick={() => setActiveTab('run')}
              role="tab"
              aria-selected={activeTab === 'run'}
              aria-controls="panel-run"
              id="tab-run"
              className={`py-2.5 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1 transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none ${
                activeTab === 'run'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <MapPin size={14} />
              <span className="truncate w-full text-center">รับ-ส่งเอกสารภายใน ({filterByDateRange(runData).length})</span>
            </button>
            <button
              onClick={() => setActiveTab('sort')}
              role="tab"
              aria-selected={activeTab === 'sort'}
              aria-controls="panel-sort"
              id="tab-sort"
              className={`py-2.5 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1 transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none ${
                activeTab === 'sort'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Inbox size={14} />
              <span className="truncate w-full text-center">คัดแยกไปรษณีย์ภัณฑ์ ({filterByDateRange(sortData).length})</span>
            </button>
            <button
              onClick={() => setActiveTab('ext')}
              role="tab"
              aria-selected={activeTab === 'ext'}
              aria-controls="panel-ext"
              id="tab-ext"
              className={`py-2.5 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1 transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none ${
                activeTab === 'ext'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Globe size={14} />
              <span className="truncate w-full text-center">นำส่งไปรษณีย์ภายนอก ({filterByDateRange(extData).length})</span>
            </button>
          </div>

          {/* Results Container */}
          <div className="max-h-64 overflow-y-auto pr-1 space-y-2.5 text-left custom-scrollbar">
            {activeTab === 'run' && (
              <div id="panel-run" role="tabpanel" aria-labelledby="tab-run">
                {filterByDateRange(runData).length > 0 ? (
                  filterByDateRange(runData).map((item, idx) => (
                    <div key={idx} className="bg-white/50 dark:bg-slate-800/30 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 p-3.5 rounded-2xl text-xs space-y-1.5 transition-all">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-800 dark:text-white text-sm">รอบสายส่ง: {item.round}</span>
                        <span className="bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider">{item.route}</span>
                      </div>
                      <div className="space-y-1 text-slate-600 dark:text-slate-400 text-xs mt-2 pl-1 border-l-2 border-purple-500/50">
                        <div>• <strong>สายส่ง:</strong> {item.route}</div>
                        <div>• <strong>จำนวนซองเอกสาร:</strong> <span className="text-slate-800 dark:text-white font-bold">{item.count}</span> ซอง</div>
                        {item.note && <div>• <strong>หมายเหตุ:</strong> {item.note}</div>}
                        <div>• <strong>วันที่ให้บริการ:</strong> {item.date}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-600 dark:text-slate-400 text-xs">ไม่มีประวัติการรับ-ส่งเอกสารภายในช่วงนี้</div>
                )}
              </div>
            )}

            {activeTab === 'sort' && (
              <div id="panel-sort" role="tabpanel" aria-labelledby="tab-sort">
                {filterByDateRange(sortData).length > 0 ? (
                  filterByDateRange(sortData).map((item, idx) => (
                    <div key={idx} className="bg-white/50 dark:bg-slate-800/30 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 p-3.5 rounded-2xl text-xs space-y-1.5 transition-all">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-800 dark:text-white text-sm">คัดแยกและนำจ่ายไปรษณีย์ภัณฑ์</span>
                        <span className="bg-orange-500/20 text-orange-600 dark:text-orange-300 px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider">สำเร็จ</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400">ยอดสะสมการคัดแยกและนำจ่ายไปรษณีย์ภัณฑ์ที่เข้ามาส่งถึงหน่วยงาน:</p>
                      <div className="space-y-1 text-slate-600 dark:text-slate-400 text-xs my-2 pl-1 border-l-2 border-orange-500/50">
                        <div>• <strong>จดหมายธรรมดา:</strong> <span className="text-slate-800 dark:text-white font-bold">{item.normal}</span> ชิ้น</div>
                        <div>• <strong>จดหมายลงทะเบียน:</strong> <span className="text-slate-800 dark:text-white font-bold">{item.register}</span> ชิ้น</div>
                        <div>• <strong>ไปรษณีย์ภัณฑ์ส่วนตัว:</strong> <span className="text-slate-800 dark:text-white font-bold">{item.private}</span> ชิ้น</div>
                        <div className="text-orange-600 dark:text-orange-400 font-extrabold pt-1 border-t border-slate-200 dark:border-white/5 mt-1">
                          • <strong>รวมทั้งหมด (Total):</strong> <span className="text-slate-800 dark:text-white">{item.total}</span> ชิ้น
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 pt-1">• <strong>วันที่และเวลาบันทึก:</strong> {item.date}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-600 dark:text-slate-400 text-xs">ไม่มีประวัติการคัดแยกและนำจ่ายไปรษณีย์ภัณฑ์ในช่วงนี้</div>
                )}
              </div>
            )}

            {activeTab === 'ext' && (
              <div id="panel-ext" role="tabpanel" aria-labelledby="tab-ext">
                {filterByDateRange(extData).length > 0 ? (
                  filterByDateRange(extData).map((item, idx) => (
                    <div key={idx} className="bg-white/50 dark:bg-slate-800/30 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 p-3.5 rounded-2xl text-xs space-y-1.5 transition-all">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-800 dark:text-white text-sm">ส่งไปรษณีย์ออกไปภายนอกองค์กร</span>
                        <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider">{item.service}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400">ประวัติการส่งไปรษณีย์ออกไปภายนอกองค์กรพร้อมรายละเอียดงบประมาณ:</p>
                      <div className="space-y-1 text-slate-600 dark:text-slate-400 text-xs my-2 pl-1 border-l-2 border-emerald-500/50">
                        <div>• <strong>ผู้ให้บริการ:</strong> {item.service} (บ.ไปรษณีย์ไทย จำกัด)</div>
                        <div>• <strong>จำนวนนำส่ง:</strong> <span className="text-slate-800 dark:text-white font-bold">{item.count}</span> ชิ้น</div>
                        <div>• <strong>ค่าบริการ:</strong> <span className="text-slate-800 dark:text-white font-bold">{item.cost}</span> บาท</div>
                        <div>• <strong>แหล่งงบประมาณ:</strong> <span className="text-emerald-600 dark:text-emerald-400 font-bold">{item.fund}</span></div>
                        <div>• <strong>หมายเลขติดตาม (Tracking):</strong> <span className="text-slate-700 dark:text-slate-300 font-mono">{item.tracking}</span> <span className="text-[9px] text-slate-600 dark:text-slate-400 font-normal">(รอการพัฒนาในเฟสถัดไป)</span></div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 pt-1">• <strong>วันที่บันทึก:</strong> {item.date}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-600 dark:text-slate-400 text-xs">ไม่มีประวัติการนำส่งไปรษณีย์ภายนอกในช่วงนี้</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onBack}
        className="text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-semibold block mx-auto transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none rounded-xl px-4 py-1"
      >
        กลับหน้าเข้าสู่ระบบ
      </button>
    </div>
  );
};
