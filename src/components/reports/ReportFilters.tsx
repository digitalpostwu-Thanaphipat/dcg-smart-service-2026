import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { GlassCard } from '../shared/GlassCard';
import { cn } from '../../lib/utils';
import { Calendar } from 'lucide-react';
import { SearchMode } from '../../types';

/**
 * ตัวกรองช่วงเวลาสำหรับหน้ารายงาน
 * รองรับ: วันนี้ / เลือกช่วงวัน / เดือนนี้ / ปีงบประมาณ
 */
export const ReportFilters: React.FC = () => {
  const { filters, setFilters } = useAppStore();

  const dateModes = [
    { id: 'today', label: 'วันนี้' },
    { id: 'custom', label: 'เลือกช่วงวัน' },
    { id: 'month', label: 'เดือนนี้' },
    { id: 'fiscal', label: 'ปีงบประมาณ' },
  ] as const;

  return (
    <GlassCard className="border-purple-500/20">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-purple-400" aria-hidden="true" />
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
            ช่วงเวลา
          </span>
        </div>

        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
          role="radiogroup"
          aria-label="เลือกช่วงเวลา"
        >
          {dateModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setFilters({ dateMode: mode.id })}
              role="radio"
              aria-checked={filters.dateMode === mode.id}
              className={cn(
                "px-3 py-2.5 text-xs font-bold rounded-xl transition-all border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none",
                filters.dateMode === mode.id
                  ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/20"
                  : "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {filters.dateMode === 'custom' && (
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-2">
              <label
                htmlFor="report-start-date"
                className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest"
              >
                จากวันที่
              </label>
              <input
                id="report-start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ startDate: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-purple-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none transition-shadow"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="report-end-date"
                className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest"
              >
                ถึงวันที่
              </label>
              <input
                id="report-end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ endDate: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-purple-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none transition-shadow"
              />
            </div>
          </div>
        )}

        {filters.dateMode === 'fiscal' && (
          <p className="text-[10px] text-slate-600 dark:text-slate-400 text-center">
            ปีงบประมาณ: 1 ตุลาคม — 30 กันยายน (ตามปฏิทินงบราชการไทย)
          </p>
        )}

        {/* Search Mode - Opt-in only */}
        <div className="pt-2 border-t border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
              โหมดค้นหา
            </span>
          </div>
          <select
            id="search-mode"
            value={filters.searchMode}
            onChange={(e) => setFilters({ searchMode: e.target.value as SearchMode })}
            className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-purple-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none transition-shadow"
          >
            <option value="department">ค้นหาตามหน่วยงาน (เดิม)</option>
            <option value="budget_owner">ค้นหาตามต้นสังกัดงบประมาณ</option>
          </select>
          <p className="text-[9px] text-slate-500 dark:text-slate-500 mt-1">
            {filters.searchMode === 'budget_owner'
              ? 'จะแสดงธุรกรรมของหน่วยงานย่อยทั้งหมดที่อยู่ในสังกัดเดียวกัน'
              : 'ค้นหาจากชื่อหน่วยงานโดยตรง (พฤติกรรมเดิม)'}
          </p>
        </div>
      </div>
    </GlassCard>
  );
};
