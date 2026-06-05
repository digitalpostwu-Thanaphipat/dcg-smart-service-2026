import React, { useMemo } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { LogItem } from '../../types';
import { RUN_SAVING_PER_UNIT } from '../../lib/constants';
import { motion } from 'framer-motion';
import { TrendingUp, Truck, PiggyBank } from 'lucide-react';

interface RunReportProps {
  logs: LogItem[];
}

/**
 * รายงานงานบริการรับ-ส่งเอกสารภายใน
 * - สรุปภาพรวม: จำนวนซอง, หน่วยงาน, ต้นทุนที่ประหยัดได้
 * - รายละเอียดแยกรายสาย (Route)
 * - คำนวณจากต้นทุน 45 บาท/ซอง หากจ้างเอกชนดำเนินการ
 */
export const RunReport: React.FC<RunReportProps> = ({ logs }) => {
  const runLogs = useMemo(() => logs.filter(l => l.type === 'run'), [logs]);

  const summary = useMemo(() => {
    const totalDocs = runLogs.reduce((sum, l) => sum + (l.count || 0), 0);
    const uniqueDepts = new Set(runLogs.map(l => l.dept)).size;
    const totalSaving = totalDocs * RUN_SAVING_PER_UNIT;

    // จัดกลุ่มตามสาย (Route)
    const routeMap: Record<string, { docs: number; depts: Set<string> }> = {};
    runLogs.forEach(l => {
      const route = l.route || 'ไม่ระบุสาย';
      if (!routeMap[route]) routeMap[route] = { docs: 0, depts: new Set() };
      routeMap[route].docs += l.count || 0;
      routeMap[route].depts.add(l.dept);
    });

    const routes = Object.entries(routeMap)
      .map(([name, data]) => ({
        name,
        docs: data.docs,
        deptCount: data.depts.size,
        saving: data.docs * RUN_SAVING_PER_UNIT,
      }))
      .sort((a, b) => b.docs - a.docs);

    return { totalDocs, uniqueDepts, totalSaving, routes };
  }, [runLogs]);

  if (runLogs.length === 0) {
    return (
      <div className="py-20 text-center space-y-4" role="status">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-slate-200 dark:border-white/5">
          <Truck size={24} className="text-slate-400 dark:text-slate-600" aria-hidden="true" />
        </div>
        <p className="text-slate-500 text-sm font-medium">
          ไม่พบข้อมูลงานรับ-ส่งเอกสารในช่วงเวลาที่เลือก
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-label="สรุปงานบริการรับ-ส่งเอกสารภายใน">
      {/* การ์ดสรุปภาพรวม */}
      <GlassCard className="border-blue-500/20">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-blue-500 dark:text-blue-400" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300">สรุปภาพรวม</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-white tabular-nums">
              {summary.totalDocs.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold mt-1">ซอง</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-white tabular-nums">
              {summary.uniqueDepts.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold mt-1">หน่วยงาน</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {summary.totalSaving.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold mt-1">บาท ที่ประหยัดได้</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-slate-200 dark:border-white/5">
          <PiggyBank size={12} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <p className="text-[10px] text-slate-600 dark:text-slate-400 text-center">
            คำนวณจากต้นทุน {RUN_SAVING_PER_UNIT} บาท/ซอง หากจ้างเอกชนดำเนินการ
          </p>
        </div>
      </GlassCard>

      {/* รายละเอียดแยกรายสาย */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">
          รายละเอียดแยกรายสาย ({summary.routes.length} สาย)
        </h3>
        {summary.routes.map((route, idx) => (
          <motion.div
            key={route.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <GlassCard className="hover:border-blue-500/30 transition-all">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">{route.name}</h4>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-100 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/5 rounded-xl p-2.5">
                  <p className="text-lg font-bold text-slate-800 dark:text-white tabular-nums">
                    {route.docs.toLocaleString()}
                  </p>
                  <p className="text-[9px] text-slate-600 dark:text-slate-400 font-semibold">ซอง</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/5 rounded-xl p-2.5">
                  <p className="text-lg font-bold text-slate-800 dark:text-white tabular-nums">
                    {route.deptCount.toLocaleString()}
                  </p>
                  <p className="text-[9px] text-slate-600 dark:text-slate-400 font-semibold">หน่วยงาน</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/5 rounded-xl p-2.5">
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {route.saving.toLocaleString()}
                  </p>
                  <p className="text-[9px] text-slate-600 dark:text-slate-400 font-semibold">บาท</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
