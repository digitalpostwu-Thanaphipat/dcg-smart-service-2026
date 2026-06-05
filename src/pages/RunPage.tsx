import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { GlassCard } from '../components/shared/GlassCard';
import { Send, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { syncEngine } from '../services/syncEngine';

export const RunPage: React.FC = () => {
  const { 
    masterData, 
    currentUser, 
    setStatus 
  } = useAppStore();

  const [runChecklist, setRunChecklist] = useState<{ dept: string, count: number, checked: boolean }[]>([]);
  const [runCommon, setRunCommon] = useState({ route: '', round: 'รอบเช้า' });
  const [uniqueRoutes, setUniqueRoutes] = useState<string[]>([]);

  useEffect(() => {
    if (masterData?.departments) {
      const routes = [...new Set(masterData.departments.map(d => d.RouteGroup).filter(Boolean))].sort() as string[];
      setUniqueRoutes(routes);
    }
  }, [masterData]);

  const handleRouteChange = (route: string) => {
    setRunCommon(prev => ({ ...prev, route }));
    if (!masterData) return;
    const depts = masterData.departments.filter(d => d.RouteGroup === route);
    setRunChecklist(depts.map(d => ({ dept: d.DeptName, count: 1, checked: false })));
  };

  const toggleCheck = (index: number) => {
    const newList = [...runChecklist];
    newList[index].checked = !newList[index].checked;
    setRunChecklist(newList);
  };

  const updateCount = (index: number, val: string) => {
    const newList = [...runChecklist];
    newList[index].count = parseInt(val) || 0;
    setRunChecklist(newList);
  };

  const saveRunBatch = async () => {
    const items = runChecklist.filter(i => i.checked && i.count > 0).map(i => ({ deptName: i.dept, itemCount: i.count }));
    if (items.length === 0) { toast.warning('กรุณาเลือกอย่างน้อย 1 รายการ'); return; }
    
    try {
      await syncEngine.saveTransaction('run', items, { ...runCommon, staffEmail: currentUser?.Email });
      setStatus({ type: 'success', text: `บันทึก ${items.length} รายการลงคิวเรียบร้อย` });
      handleRouteChange(runCommon.route);
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setStatus({ type: 'error', text: 'เกิดข้อผิดพลาดในการบันทึก' });
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <GlassCard>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 space-y-2">
            <label htmlFor="run-route-select" className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">เส้นทางรับ-ส่ง</label>
            <select 
              id="run-route-select"
              value={runCommon.route}
              onChange={(e) => handleRouteChange(e.target.value)}
              className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 focus-visible:outline-none transition-all outline-none"
            >
              <option value="" className="text-slate-500 dark:bg-slate-900">เลือกเส้นทาง...</option>
              {uniqueRoutes.map(r => <option key={r} value={r} className="text-slate-800 dark:text-white dark:bg-slate-900">{r}</option>)}
            </select>
          </div>
          <div className="flex-1 space-y-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider block">รอบการส่ง</span>
            <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-300/40 dark:border-white/10 transition-colors duration-300" role="radiogroup" aria-label="รอบการส่ง">
              {['รอบเช้า', 'รอบบ่าย'].map(r => (
                <button
                  key={r}
                  onClick={() => setRunCommon(p => ({ ...p, round: r }))}
                  role="radio"
                  aria-checked={runCommon.round === r}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 focus-visible:outline-none",
                    runCommon.round === r 
                      ? "bg-blue-600 text-white shadow-lg" 
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {runCommon.route && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">รายการหน่วยงาน ({runChecklist.length})</h3>
              <button 
                onClick={() => setRunChecklist(p => p.map(i => ({ ...i, checked: true })))}
                className="text-[10px] font-bold text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 uppercase tracking-tighter transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded px-1.5"
              >
                เลือกทั้งหมด
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {runChecklist.map((item, idx) => (
                <div 
                  key={`${item.dept}-${idx}`}
                  onClick={() => toggleCheck(idx)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      toggleCheck(idx);
                      e.preventDefault();
                    }
                  }}
                  role="checkbox"
                  aria-checked={item.checked}
                  className={cn(
                    "group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 focus-visible:outline-none",
                    item.checked 
                      ? "bg-blue-50 dark:bg-blue-600/10 border-blue-400/60 dark:border-blue-500/50 text-blue-900 dark:text-blue-100" 
                      : "bg-slate-100/60 dark:bg-slate-800/30 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-slate-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {item.checked 
                      ? <CheckCircle2 size={18} className="text-blue-600 dark:text-blue-400" /> 
                      : <Circle size={18} className="text-slate-400 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400" />
                    }
                    <span className={cn("text-xs md:text-sm font-medium", item.checked ? "text-slate-800 dark:text-white font-bold" : "text-slate-600 dark:text-slate-400")}>
                      {item.dept}
                    </span>
                  </div>
                  {item.checked && (
                    <div 
                      className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-blue-500/20 rounded-2xl p-1 shadow-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.max(0, item.count - 1);
                          updateCount(idx, val.toString());
                        }}
                        className="w-10 h-10 clay-btn bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-sm flex items-center justify-center select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                      >
                        -
                      </button>
                      <input 
                        aria-label={`จำนวนซองเอกสารของ ${item.dept}`}
                        type="number"
                        value={item.count}
                        onChange={(e) => updateCount(idx, e.target.value)}
                        className="w-8 bg-transparent text-center text-xs font-black text-slate-800 dark:text-blue-200 outline-none border-none focus:ring-1 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = item.count + 1;
                          updateCount(idx, val.toString());
                        }}
                        className="w-10 h-10 clay-btn bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-sm flex items-center justify-center select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button 
              onClick={saveRunBatch}
              className="w-full mt-4 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              <Send size={18} />
              บันทึกการรับ-ส่ง
            </button>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
