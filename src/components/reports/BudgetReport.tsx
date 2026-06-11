import React, { useMemo, useState } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { LogItem } from '../../types';
import { RUN_SAVING_PER_UNIT } from '../../lib/constants';
import { useAppStore } from '../../store/useAppStore';
import { getRealOwner } from '../../utils/helpers';
import { summarizeFundsBySource } from '../../utils/fundSource';
import { motion } from 'framer-motion';
import { TrendingUp, Package, Banknote, Search, ShieldAlert, Award } from 'lucide-react';

interface BudgetReportProps {
  logs: LogItem[];
}

export const BudgetReport: React.FC<BudgetReportProps> = ({ logs }) => {
  const { masterData } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');

  // ───────────── การคำนวณและกรองข้อมูล ─────────────

  const runLogs = useMemo(() => logs.filter(l => l.type === 'run'), [logs]);
  const extLogs = useMemo(() => logs.filter(l => l.type === 'ext'), [logs]);

  const stats = useMemo(() => {
    // 1. คำนวณฝั่งประหยัด (Run)
    const runCount = runLogs.reduce((sum, l) => sum + (l.count || 0), 0);
    const totalSaving = runCount * RUN_SAVING_PER_UNIT;

    // 2. คำนวณฝั่งจ่าย (External)
    const totalCost = extLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
    const extCount = extLogs.reduce((sum, l) => sum + (l.count || 0), 0);

    // 3. ผลตอบแทนสุทธิ
    const netValue = totalSaving - totalCost;

    // 4. แยกข้อมูลตามแหล่งงบประมาณ (External Fund Source)
    const fundBreakdown = summarizeFundsBySource(extLogs);

    // 5. จัดกลุ่มข้อมูลตามหน่วยงาน (Departmental Aggregation)
    const deptMap: Record<
      string,
      {
        deptName: string;
        runCount: number;
        runSaving: number;
        sortCount: number;
        extCount: number;
        extCost: number;
        netImpact: number;
      }
    > = {};

    logs.forEach(l => {
      // ดึงชื่อแผนกจริง (ป้องกัน Alias แตกต่างกัน)
      const resolvedName = getRealOwner(l.dept, masterData?.departments) || l.dept;
      if (!deptMap[resolvedName]) {
        deptMap[resolvedName] = {
          deptName: resolvedName,
          runCount: 0,
          runSaving: 0,
          sortCount: 0,
          extCount: 0,
          extCost: 0,
          netImpact: 0,
        };
      }

      const item = deptMap[resolvedName];
      if (l.type === 'run') {
        item.runCount += l.count || 0;
        item.runSaving += (l.count || 0) * RUN_SAVING_PER_UNIT;
      } else if (l.type === 'sort') {
        item.sortCount += l.count || 0;
      } else if (l.type === 'ext') {
        item.extCount += l.count || 0;
        item.extCost += l.cost || 0;
      }
    });

    // คำนวณมูลค่าสุทธิแต่ละแผนก
    Object.values(deptMap).forEach(item => {
      item.netImpact = item.runSaving - item.extCost;
    });

    const deptsArray = Object.values(deptMap).sort((a, b) => b.extCost - a.extCost || b.runSaving - a.runSaving);

    return {
      runCount,
      totalSaving,
      totalCost,
      extCount,
      netValue,
      fundBreakdown,
      deptsArray,
    };
  }, [runLogs, extLogs, logs, masterData]);

  // กรองตารางแผนกตามคำค้นหา
  const filteredDepts = useMemo(() => {
    return stats.deptsArray.filter(d =>
      d.deptName.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  }, [stats.deptsArray, searchTerm]);

  const maxFundCost = useMemo(() => {
    const values = Object.values(stats.fundBreakdown).map(f => f.cost);
    return Math.max(...values, 1);
  }, [stats.fundBreakdown]);

  return (
    <div className="space-y-6" aria-label="สรุปสถิติงบประมาณและค่าใช้จ่าย">
      {/* 1. การ์ดตัวชี้วัดหลัก (Metric Cards Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* มูลค่าประหยัดสะสม */}
        <GlassCard className="border-blue-500/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              มูลค่าประหยัดสะสม (รับ-ส่งภายใน)
            </span>
            <TrendingUp size={16} className="text-blue-500 dark:text-blue-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-2xl font-black text-slate-800 dark:text-white tabular-nums">
              {stats.totalSaving.toLocaleString()} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">บาท</span>
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              จากการรับ-ส่งซองเอกสาร {stats.runCount.toLocaleString()} ซอง (45 บาท/ซอง)
            </p>
          </div>
        </GlassCard>

        {/* ค่าใช้จ่ายส่งไปรษณีย์ภายนอก */}
        <GlassCard className="border-emerald-500/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              ค่าใช้จ่ายรวม (ส่งไปรษณีย์ภายนอก)
            </span>
            <Package size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {stats.totalCost.toLocaleString()} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">บาท</span>
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              จากการนำส่งพัสดุภายนอก {stats.extCount.toLocaleString()} ชิ้น
            </p>
          </div>
        </GlassCard>

        {/* ผลประโยชน์สุทธิทางการขนส่ง */}
        <GlassCard className={stats.netValue >= 0 ? 'border-purple-500/20' : 'border-rose-500/20'}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              ผลประโยชน์ทางการขนส่งสุทธิ
            </span>
            <Banknote size={16} className={stats.netValue >= 0 ? 'text-purple-500 dark:text-purple-400' : 'text-rose-500 dark:text-rose-400'} />
          </div>
          <div className="space-y-1">
            <h4 className={`text-2xl font-black tabular-nums ${stats.netValue >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {stats.netValue >= 0 ? '+' : ''}{stats.netValue.toLocaleString()} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">บาท</span>
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <Award size={10} className={stats.netValue >= 0 ? 'text-purple-500' : 'text-rose-500'} />
              {stats.netValue >= 0 ? 'ประหยัดงบรวมเชิงบวกให้กับมหาวิทยาลัย' : 'งบประมาณสะสมติดลบสุทธิ'}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* 2. แยกรายละเอียดตามแหล่งงบประมาณ */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Banknote size={16} className="text-purple-600 dark:text-purple-400" />
          <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
            สัดส่วนค่าบริการภายนอกแยกตามแหล่งงบประมาณ
          </h3>
        </div>
        <div className="space-y-4">
          {Object.entries(stats.fundBreakdown).map(([fundName, data], idx) => (
            <motion.div
              key={fundName}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-300">{fundName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-600 dark:text-slate-400">{data.items.toLocaleString()} ชิ้น</span>
                  <span className="font-bold text-slate-800 dark:text-white min-w-[70px] text-right">
                    {data.cost.toLocaleString()} บาท
                  </span>
                </div>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(data.cost / maxFundCost) * 100}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </GlassCard>

      {/* 3. ตารางสรุปจำแนกตามหน่วยงาน */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
            วิเคราะห์งบประมาณรายหน่วยงาน ({filteredDepts.length} แผนก)
          </h3>

          {/* ค้นหาหน่วยงาน */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="ค้นหาชื่อหน่วยงาน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-purple-500"
              aria-label="ค้นหาหน่วยงานในตารางงบประมาณ"
            />
            <Search className="absolute left-3 top-3.5 w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* ตารางแสดงผล */}
        <div className="overflow-x-auto bg-white/40 dark:bg-slate-950/20 rounded-3xl border border-slate-200 dark:border-white/5 shadow-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/30 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                <th scope="col" className="px-5 py-3.5">หน่วยงาน (Department)</th>
                <th scope="col" className="px-3 py-3.5 text-center">รับ-ส่งใน (ซอง)</th>
                <th scope="col" className="px-3 py-3.5 text-right">ยอดประหยัด (บาท)</th>
                <th scope="col" className="px-3 py-3.5 text-center">คัดแยก (ชิ้น)</th>
                <th scope="col" className="px-3 py-3.5 text-center">ส่งนอก (ชิ้น)</th>
                <th scope="col" className="px-3 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">ค่าส่งนอก (บาท)</th>
                <th scope="col" className="px-5 py-3.5 text-right">สุทธิ (บาท)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-slate-700 dark:text-slate-300">
              {filteredDepts.map((d, index) => (
                <tr
                  key={d.deptName}
                  className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors"
                >
                  <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-200">{d.deptName}</td>
                  <td className="px-3 py-3 text-center tabular-nums">{d.runCount.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right text-blue-600 dark:text-blue-400 tabular-nums">
                    {d.runSaving.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums">{d.sortCount.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center tabular-nums">{d.extCount.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                    {d.extCost.toLocaleString()}
                  </td>
                  <td className={`px-5 py-3 text-right font-bold tabular-nums ${d.netImpact >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-rose-500'}`}>
                    {d.netImpact >= 0 ? '+' : ''}{d.netImpact.toLocaleString()}
                  </td>
                </tr>
              ))}

              {filteredDepts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldAlert size={20} className="text-slate-600" />
                      <span>ไม่พบข้อมูลหน่วยงานตามที่ระบุ</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
