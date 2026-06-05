import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { GlassCard } from '../components/shared/GlassCard';
import { Plus, Trash2, Send, Banknote } from 'lucide-react';
import { motion } from 'framer-motion';
import { FUND_SOURCES } from '../lib/constants';
import SmartSearchInput from '../components/common/SmartSearchInput';
import { getDeptDisplay } from '../utils/helpers';
import { syncEngine } from '../services/syncEngine';
import { toast } from 'sonner';
import { Department } from '../types';

export const ExternalPage: React.FC = () => {
  const { 
    masterData, 
    currentUser, 
    setStatus,
    addRecentDept,
    recentDepts
  } = useAppStore();

  const [extCart, setExtCart] = useState<any[]>([]);
  const [extInput, setExtInput] = useState({ dept: '', service: '', cost: '', count: '', track: '', fund: 'งบประมาณมหาวิทยาลัย' });

  const filteredServices = masterData?.services.filter(s => 
    !s.ServiceName.toLowerCase().includes('flash') && 
    !s.ServiceName.toLowerCase().includes('kerry') && 
    !s.ServiceName.includes('เอกชน')
  ) || [];

  const addToCart = () => {
    if (!extInput.dept || !extInput.service || !extInput.fund) { toast.warning('กรุณากรอกข้อมูลให้ครบถ้วน'); return; }
    
    const cleanDept = masterData?.departments.find((d: Department) => 
      getDeptDisplay(d) === extInput.dept || d.DeptName === extInput.dept
    );
    const cleanName = cleanDept ? cleanDept.DeptName : extInput.dept;
    const displayName = cleanDept ? getDeptDisplay(cleanDept) : extInput.dept;
    
    setExtCart([...extCart, { 
      deptName: cleanName, 
      displayName: displayName,
      serviceType: extInput.service, 
      cost: extInput.cost || '0', 
      itemCount: extInput.count || '1', 
      trackingNo: extInput.track, 
      fundSource: extInput.fund 
    }]);
    
    setExtInput({ dept: '', service: '', cost: '', count: '', track: '', fund: 'งบประมาณมหาวิทยาลัย' });
    addRecentDept(displayName);
  };

  const removeFromCart = (idx: number) => {
    setExtCart(extCart.filter((_, i: number) => i !== idx));
  };

  const saveCart = async () => {
    if (extCart.length === 0) return;
    try {
      const itemsToSave = extCart.map((i: any) => ({
        deptName: i.deptName,
        serviceType: i.serviceType,
        cost: i.cost,
        itemCount: i.itemCount,
        trackingNo: i.trackingNo,
        fundSource: i.fundSource
      }));
      await syncEngine.saveTransaction('ext', itemsToSave, { staffEmail: currentUser?.Email });
      setStatus({ type: 'success', text: 'บันทึกรายการนำส่งไปรษณีย์เรียบร้อย' });
      setExtCart([]);
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setStatus({ type: 'error', text: 'เกิดข้อผิดพลาดในการบันทึก' });
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const totalCost = extCart.reduce((sum: number, item: any) => sum + (parseFloat(item.cost) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <GlassCard>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="ext-dept-search" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">หน่วยงาน/ผู้ส่ง</label>
            <SmartSearchInput 
              id="ext-dept-search"
              value={extInput.dept}
              onChange={(val) => setExtInput(p => ({ ...p, dept: val }))}
              placeholder="ค้นหาหน่วยงาน..."
              departments={masterData?.departments || []}
              recentDepts={recentDepts}
              onRecentClick={(d) => setExtInput(p => ({ ...p, dept: d }))}
              themeColor="text-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="ext-service" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ประเภทบริการ</label>
              <select 
                id="ext-service"
                value={extInput.service}
                onChange={(e) => setExtInput(p => ({ ...p, service: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 focus-visible:outline-none outline-none transition-all"
              >
                <option value="" className="dark:bg-slate-950">เลือกบริการ...</option>
                {filteredServices.map(s => <option key={s.ServiceName} value={s.ServiceName} className="dark:bg-slate-950">{s.ServiceName}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="ext-fund" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">แหล่งงบประมาณ</label>
              <select 
                id="ext-fund"
                value={extInput.fund}
                onChange={(e) => setExtInput(p => ({ ...p, fund: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 focus-visible:outline-none outline-none transition-all"
              >
                {FUND_SOURCES.map(f => <option key={f} value={f} className="dark:bg-slate-950">{f}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="ext-item-count" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">จำนวนชิ้น</label>
              <div className="flex items-center justify-between bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(extInput.count) || 1;
                    setExtInput(p => ({ ...p, count: Math.max(1, current - 1).toString() }));
                  }}
                  className="w-11 h-11 clay-btn bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-lg select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                >
                  -
                </button>
                <input 
                  id="ext-item-count"
                  type="number"
                  placeholder="1"
                  value={extInput.count}
                  onChange={(e) => setExtInput(p => ({ ...p, count: e.target.value }))}
                  className="w-12 bg-transparent text-slate-800 dark:text-white text-center text-base font-black outline-none border-none focus:ring-1 focus:ring-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(extInput.count) || 1;
                    setExtInput(p => ({ ...p, count: (current + 1).toString() }));
                  }}
                  className="w-11 h-11 clay-btn bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-lg select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                >
                  +
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="ext-item-cost" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ค่าบริการ (บาท)</label>
              <input 
                id="ext-item-cost"
                type="number"
                placeholder="0.00"
                value={extInput.cost}
                onChange={(e) => setExtInput(p => ({ ...p, cost: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 focus-visible:outline-none outline-none transition-all"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-2">
              <label htmlFor="ext-tracking" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">หมายเลขไปรษณีย์ภัณฑ์</label>
              <input 
                id="ext-tracking"
                type="text"
                placeholder="เช่น RL123456789TH"
                value={extInput.track}
                onChange={(e) => setExtInput(p => ({ ...p, track: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 focus-visible:outline-none outline-none transition-all"
              />
            </div>
          </div>

          <button 
            onClick={addToCart}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/20 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
          >
            <Plus size={18} />
            เพิ่มรายการส่งออก
          </button>
        </div>
      </GlassCard>

      {extCart.length > 0 && (
        <div className="space-y-4 pb-12">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">รายการเตรียมส่ง ({extCart.length})</h3>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
              <Banknote size={16} />
              <span className="text-lg">{totalCost.toLocaleString()}</span>
              <span className="text-[10px] mt-1 text-slate-600 dark:text-slate-400">บาท</span>
            </div>
          </div>
          
          <div className="space-y-2">
            {extCart.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex items-center justify-between group transition-colors duration-300"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">{item.displayName}</h4>
                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold rounded uppercase border border-emerald-500/20 dark:border-emerald-500/10">
                      {item.serviceType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-[10px] text-slate-600 dark:text-slate-400">จำนวน: {item.itemCount} ชิ้น</p>
                    {item.trackingNo && <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">{item.trackingNo}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{parseFloat(item.cost).toLocaleString()}</span>
                    <span className="text-[8px] text-slate-600 dark:text-slate-400 block">บาท</span>
                  </div>
                  <button 
                    onClick={() => removeFromCart(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg"
                    aria-label={`ลบรายการ ${item.displayName}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          <button 
            onClick={saveCart}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-extrabold shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
          >
            <Send size={18} />
            ยืนยันนำส่งไปรษณีย์
          </button>
        </div>
      )}
    </div>
  );
};
