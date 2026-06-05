import React, { useMemo } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { LogItem } from '../../types';
import { FUND_SOURCES } from '../../lib/constants';
import { motion } from 'framer-motion';
import { Package, Banknote } from 'lucide-react';

interface ExtReportProps {
  logs: LogItem[];
}

/**
 * รายงานงานบริการนำส่งไปรษณีย์ภัณฑ์ภายในถึงหน่วยงานภายนอก
 * - สรุปภาพรวม: จำนวนชิ้น, หน่วยงาน, ค่าใช้จ่ายรวม
 * - แยกตาม 3 แหล่งงบประมาณ
 * - ไม่แสดงรายสาย (ตามที่ผู้ใช้กำหนด)
 */
export const ExtReport: React.FC<ExtReportProps> = ({ logs }) => {
  const extLogs = useMemo(() => logs.filter(l => l.type === 'ext'), [logs]);

  const summary = useMemo(() => {
    const totalItems = extLogs.reduce((sum, l) => sum + (l.count || 0), 0);
    const uniqueDepts = new Set(extLogs.map(l => l.dept)).size;
    const totalCost = extLogs.reduce((sum, l) => sum + (l.cost || 0), 0);

    // จัดกลุ่มตามแหล่งงบประมาณ
    const fundBreakdown: Record<string, { items: number; cost: number; depts: Set<string> }> = {};
    FUND_SOURCES.forEach(fund => {
      fundBreakdown[fund] = { items: 0, cost: 0, depts: new Set() };
    });

    extLogs.forEach(l => {
      const fund = l.fund || 'งบประมาณมหาวิทยาลัย';
      if (!fundBreakdown[fund]) {
        fundBreakdown[fund] = { items: 0, cost: 0, depts: new Set() };
      }
      fundBreakdown[fund].items += l.count || 0;
      fundBreakdown[fund].cost += l.cost || 0;
      fundBreakdown[fund].depts.add(l.dept);
    });

    const funds = Object.entries(fundBreakdown)
      .map(([name, data]) => ({
        name,
        items: data.items,
        cost: data.cost,
        deptCount: data.depts.size,
      }));

    return { totalItems, uniqueDepts, totalCost, funds };
  }, [extLogs]);

  if (extLogs.length === 0) {
    return (
      <div className="py-20 text-center space-y-4" role="status">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-slate-200 dark:border-white/5">
          <Package size={24} className="text-slate-400 dark:text-slate-600" aria-hidden="true" />
        </div>
        <p className="text-slate-500 text-sm font-medium">
          ไม่พบข้อมูลงานนำส่งภายนอกในช่วงเวลาที่เลือก
        </p>
      </div>
    );
  }

  const maxCost = Math.max(...summary.funds.map(f => f.cost), 1);

  return (
    <div className="space-y-4" aria-label="สรุปงานบริการนำส่งไปรษณีย์ภัณฑ์ภายนอก">
      {/* การ์ดสรุปภาพรวม */}
      <GlassCard className="border-emerald-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Package size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300">สรุปภาพรวม</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-white tabular-nums">
              {summary.totalItems.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold mt-1">ชิ้น</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-white tabular-nums">
              {summary.uniqueDepts.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold mt-1">หน่วยงาน</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {summary.totalCost.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold mt-1">บาท</p>
          </div>
        </div>
      </GlassCard>

      {/* แยกตามงบประมาณ */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Banknote size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
            แยกตามงบประมาณ
          </h3>
        </div>
        <div className="space-y-4">
          {summary.funds.map((fund, idx) => (
            <motion.div
              key={fund.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-300">{fund.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-slate-600 dark:text-slate-400">
                    {fund.items.toLocaleString()} ชิ้น · {fund.deptCount} หน่วยงาน
                  </span>
                  <span className="font-bold text-slate-800 dark:text-white min-w-[80px] text-right">
                    {fund.cost.toLocaleString()} บาท
                  </span>
                </div>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(fund.cost / maxCost) * 100}%` }}
                  transition={{ duration: 0.6, delay: idx * 0.1 }}
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* ยอดรวม */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">ยอดรวมทั้งหมด</span>
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {summary.totalCost.toLocaleString()} บาท
          </span>
        </div>
      </GlassCard>
    </div>
  );
};
