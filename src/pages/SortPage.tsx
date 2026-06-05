import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { GlassCard } from '../components/shared/GlassCard';
import { Plus, Trash2, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import SmartSearchInput from '../components/common/SmartSearchInput';
import { getDeptDisplay } from '../utils/helpers';
import { syncEngine } from '../services/syncEngine';
import { toast } from 'sonner';
import { Department } from '../types';

interface SortCartItem {
  deptName: string;
  displayName: string;
  normalCount: string;
  registerCount: string;
  privateCount: string;
  total: number;
}

export const SortPage: React.FC = () => {
  const { 
    masterData, 
    currentUser, 
    setStatus,
    addRecentDept,
    recentDepts
  } = useAppStore();

  const [sortCart, setSortCart] = useState<SortCartItem[]>([]);
  const [sortInput, setSortInput] = useState({ dept: '', normal: '', reg: '', private: '' });

  const addToCart = () => {
    const normal = parseInt(sortInput.normal) || 0;
    const reg = parseInt(sortInput.reg) || 0;
    const priv = parseInt(sortInput.private) || 0;
    const total = normal + reg + priv;

    if (!sortInput.dept || total === 0) {
      return toast.warning('กรุณากรอกข้อมูลหน่วยงานและจำนวนไปรษณีย์ภัณฑ์');
    }
    
    const cleanDept = masterData?.departments.find((d: Department) => 
      getDeptDisplay(d) === sortInput.dept || d.DeptName === sortInput.dept
    );
    const cleanName = cleanDept ? cleanDept.DeptName : sortInput.dept;
    const displayName = cleanDept ? getDeptDisplay(cleanDept) : sortInput.dept;
    
    setSortCart([...sortCart, { 
      deptName: cleanName, 
      displayName: displayName,
      normalCount: sortInput.normal || '0', 
      registerCount: sortInput.reg || '0', 
      privateCount: sortInput.private || '0',
      total 
    }]);
    setSortInput({ dept: '', normal: '', reg: '', private: '' });
    addRecentDept(displayName);
  };

  const removeFromCart = (idx: number) => {
    setSortCart(sortCart.filter((_, i) => i !== idx));
  };

  const saveCart = async () => {
    if (sortCart.length === 0) return;
    try {
      const itemsToSave = sortCart.map((i: SortCartItem) => ({
        deptName: i.deptName,
        normalCount: parseInt(i.normalCount) || 0,
        registerCount: parseInt(i.registerCount) || 0,
        privateCount: parseInt(i.privateCount) || 0,
        total: i.total
      }));
      await syncEngine.saveTransaction('sort', itemsToSave, { staffEmail: currentUser?.Email });
      setStatus({ type: 'success', text: 'บันทึกรายการคัดแยกลงคิวเรียบร้อย' });
      setSortCart([]);
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setStatus({ type: 'error', text: 'เกิดข้อผิดพลาดในการบันทึก' });
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <GlassCard>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="sort-dept-search" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">หน่วยงานรับบริการ</label>
            <SmartSearchInput 
              id="sort-dept-search"
              value={sortInput.dept}
              onChange={(val: string) => setSortInput(p => ({ ...p, dept: val }))}
              placeholder="ค้นหาชื่อหน่วยงาน..."
              departments={masterData?.departments || []}
              recentDepts={recentDepts}
              onRecentClick={(d: string) => setSortInput(p => ({ ...p, dept: d }))}
              themeColor="text-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* ไปรษณีย์ธรรมดา */}
            <div className="space-y-2">
              <label htmlFor="sort-normal-count" className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">ไปรษณีย์ธรรมดา</label>
              <div className="flex items-center justify-between bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-orange-500 transition-all">
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(sortInput.normal) || 0;
                    setSortInput(p => ({ ...p, normal: Math.max(0, current - 1).toString() }));
                  }}
                  className="w-11 h-11 clay-btn bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-lg select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 focus-visible:outline-none"
                >
                  -
                </button>
                <input 
                  id="sort-normal-count"
                  type="number"
                  placeholder="0"
                  value={sortInput.normal}
                  onChange={(e) => setSortInput(p => ({ ...p, normal: e.target.value }))}
                  className="w-12 bg-transparent text-slate-800 dark:text-white text-center text-base font-black outline-none border-none focus:ring-1 focus:ring-orange-500 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(sortInput.normal) || 0;
                    setSortInput(p => ({ ...p, normal: (current + 1).toString() }));
                  }}
                  className="w-11 h-11 clay-btn bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-lg select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 focus-visible:outline-none"
                >
                  +
                </button>
              </div>
            </div>

            {/* ไปรษณีย์ลงทะเบียน */}
            <div className="space-y-2">
              <label htmlFor="sort-reg-count" className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">ไปรษณีย์ลงทะเบียน</label>
              <div className="flex items-center justify-between bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-orange-500 transition-all">
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(sortInput.reg) || 0;
                    setSortInput(p => ({ ...p, reg: Math.max(0, current - 1).toString() }));
                  }}
                  className="w-11 h-11 clay-btn bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-lg select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 focus-visible:outline-none"
                >
                  -
                </button>
                <input 
                  id="sort-reg-count"
                  type="number"
                  placeholder="0"
                  value={sortInput.reg}
                  onChange={(e) => setSortInput(p => ({ ...p, reg: e.target.value }))}
                  className="w-12 bg-transparent text-slate-800 dark:text-white text-center text-base font-black outline-none border-none focus:ring-1 focus:ring-orange-500 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(sortInput.reg) || 0;
                    setSortInput(p => ({ ...p, reg: (current + 1).toString() }));
                  }}
                  className="w-11 h-11 clay-btn bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-lg select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 focus-visible:outline-none"
                >
                  +
                </button>
              </div>
            </div>

            {/* ไปรษณีย์ส่วนตัว */}
            <div className="space-y-2">
              <label htmlFor="sort-private-count" className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">ไปรษณีย์ส่วนตัว</label>
              <div className="flex items-center justify-between bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-orange-500 transition-all">
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(sortInput.private) || 0;
                    setSortInput(p => ({ ...p, private: Math.max(0, current - 1).toString() }));
                  }}
                  className="w-11 h-11 clay-btn bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-lg select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 focus-visible:outline-none"
                >
                  -
                </button>
                <input 
                  id="sort-private-count"
                  type="number"
                  placeholder="0"
                  value={sortInput.private}
                  onChange={(e) => setSortInput(p => ({ ...p, private: e.target.value }))}
                  className="w-12 bg-transparent text-slate-800 dark:text-white text-center text-base font-black outline-none border-none focus:ring-1 focus:ring-orange-500 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(sortInput.private) || 0;
                    setSortInput(p => ({ ...p, private: (current + 1).toString() }));
                  }}
                  className="w-11 h-11 clay-btn bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-lg select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 focus-visible:outline-none"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <button 
            onClick={addToCart}
            className="w-full py-3.5 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800/60 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-white/5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 focus-visible:outline-none"
          >
            <Plus size={18} />
            เพิ่มลงรายการ
          </button>
        </div>
      </GlassCard>

      {sortCart.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 px-1 uppercase tracking-widest">รายการเตรียมบันทึก ({sortCart.length})</h3>
          <div className="space-y-2">
            {sortCart.map((item: SortCartItem, idx: number) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex items-center justify-between transition-colors duration-300"
              >
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">{item.displayName}</h4>
                  <p className="text-[10px] text-slate-500 mt-1">
                    ธรรมดา: {item.normalCount || 0} | ลงทะเบียน: {item.registerCount || 0} | ส่วนตัว: {item.privateCount || 0}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{item.total}</span>
                    <span className="text-[8px] text-slate-400 dark:text-slate-500 block">รวม</span>
                  </div>
                  <button 
                    onClick={() => removeFromCart(idx)}
                    className="p-2 text-rose-500/50 hover:text-rose-500 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded-lg"
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
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold shadow-xl shadow-orange-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 focus-visible:outline-none"
          >
            <Send size={18} />
            ยืนยันบันทึกทั้งหมด
          </button>
        </div>
      )}
    </div>
  );
};
