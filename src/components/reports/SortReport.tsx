import React, { useMemo } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { LogItem } from '../../types';
import { motion } from 'framer-motion';
import { Mail, Inbox } from 'lucide-react';

interface SortReportProps {
  logs: LogItem[];
}

/**
 * รายงานงานบริการคัดแยก-นำจ่ายไปรษณีย์ภัณฑ์
 * - สรุปภาพรวม: จำนวนชิ้น, หน่วยงาน
 * - แยกประเภท: ไปรษณีย์ภัณฑ์ที่เกี่ยวกับงาน (ธรรมดา + ลงทะเบียน) / ไปรษณีย์ภัณฑ์ส่วนตัว (PrivateCount)
 * - ไม่แสดงรายสาย (ตามที่ผู้ใช้กำหนด)
 */
export const SortReport: React.FC<SortReportProps> = ({ logs }) => {
  const sortLogs = useMemo(() => logs.filter(l => l.type === 'sort'), [logs]);

  const summary = useMemo(() => {
    const totalItems = sortLogs.reduce((sum, l) => sum + (l.count || 0), 0);
    const uniqueDepts = new Set(sortLogs.map(l => l.dept)).size;
    const totalNormal = sortLogs.reduce((sum, l) => sum + (l.normalCount || 0), 0);
    const totalRegister = sortLogs.reduce((sum, l) => sum + (l.registerCount || 0), 0);
    const totalPrivate = sortLogs.reduce((sum, l) => sum + (l.privateCount || 0), 0);
    const totalWork = totalNormal + totalRegister;

    return { totalItems, uniqueDepts, totalWork, totalPrivate, totalNormal, totalRegister };
  }, [sortLogs]);

  if (sortLogs.length === 0) {
    return (
      <div className="py-20 text-center space-y-4" role="status">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-slate-200 dark:border-white/5">
          <Mail size={24} className="text-slate-400 dark:text-slate-600" aria-hidden="true" />
        </div>
        <p className="text-slate-500 text-sm font-medium">
          ไม่พบข้อมูลงานคัดแยก-นำจ่ายในช่วงเวลาที่เลือก
        </p>
      </div>
    );
  }

  const statsCards = [
    {
      label: 'จำนวนไปรษณีย์ภัณฑ์ทั้งหมด',
      value: summary.totalItems,
      unit: 'ชิ้น',
      color: 'text-slate-800 dark:text-white',
      bg: 'bg-slate-100 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/5',
    },
    {
      label: 'จำนวนหน่วยงานรับบริการ',
      value: summary.uniqueDepts,
      unit: 'แห่ง',
      color: 'text-slate-800 dark:text-white',
      bg: 'bg-slate-100 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/5',
    },
    {
      label: 'ไปรษณีย์ภัณฑ์ที่เกี่ยวกับงาน (ธรรมดา + ลงทะเบียน)',
      value: summary.totalWork,
      unit: 'ชิ้น',
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-500/5 border border-orange-500/20 dark:border-orange-500/10',
      subtext: `ธรรมดา: ${summary.totalNormal} | ลงทะเบียน: ${summary.totalRegister}`
    },
    {
      label: 'ไปรษณีย์ภัณฑ์ส่วนตัว',
      value: summary.totalPrivate,
      unit: 'ชิ้น',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/5 border border-amber-500/20 dark:border-amber-500/10',
      subtext: 'ไม่เกี่ยวข้องกับงานราชการ'
    },
  ];

  return (
    <div className="space-y-4" aria-label="สรุปงานบริการคัดแยก-นำจ่ายไปรษณีย์ภัณฑ์">
      <GlassCard className="border-orange-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Inbox size={16} className="text-orange-500 dark:text-orange-400" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300">สรุปภาพรวม</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {statsCards.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-xl p-4 text-center flex flex-col justify-between ${stat.bg}`}
            >
              <div>
                <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>
                  {stat.value.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold mt-1">{stat.unit}</p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold mt-1.5">{stat.label}</p>
              </div>
              {stat.subtext && (
                <p className="text-[9px] text-slate-600 dark:text-slate-400 mt-2 border-t border-slate-200 dark:border-white/5 pt-1.5 font-medium">
                  {stat.subtext}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};
