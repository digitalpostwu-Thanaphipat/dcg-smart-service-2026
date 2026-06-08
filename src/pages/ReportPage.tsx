import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../services/api';
import { GlassCard } from '../components/shared/GlassCard';
import {
  Search, Trash2, Copy,
  TrendingUp, Mail, Package,
  CloudOff, RefreshCw, ListFilter, Link
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getRealOwner } from '../utils/helpers';
import { LogItem } from '../types';
import { getNonSyncedLogs, deleteLogLocal } from '../lib/db';
import { ReportFilters } from '../components/reports/ReportFilters';
import { RunReport } from '../components/reports/RunReport';
import { SortReport } from '../components/reports/SortReport';
import { ExtReport } from '../components/reports/ExtReport';
import { RUN_SAVING_PER_UNIT } from '../lib/constants';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

type ReportTab = 'list' | 'run' | 'sort' | 'ext';

/**
 * คำนวณช่วงวันที่จาก dateMode
 * ปีงบประมาณไทย: 1 ตุลาคม — 30 กันยายน
 */
function getDateRange(filters: { dateMode: string; startDate: string; endDate: string }) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  switch (filters.dateMode) {
    case 'today':
      return { start: todayStr, end: todayStr };

    case 'month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0],
      };
    }

    case 'fiscal': {
      // ปีงบประมาณไทย: ต.ค. ปีก่อน → ก.ย. ปีปัจจุบัน
      const year = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
      return {
        start: `${year}-10-01`,
        end: `${year + 1}-09-30`,
      };
    }

    case 'custom':
    default:
      return { start: filters.startDate, end: filters.endDate };
  }
}

export const ReportPage: React.FC = () => {
  const {
    masterData,
    currentUser,
    setLoading,
    setStatus,
    filters,
  } = useAppStore();

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [reportTab, setReportTab] = useState<ReportTab>('list');
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: string; dept: string } | null>(null);

  // ───────────── ดึงข้อมูล (API + IndexedDB) ─────────────

  const fetchLogs = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // 1. ดึงจาก API
      let apiList: LogItem[] = [];
      try {
        const json = await api.searchLogs(filters, currentUser.Email);
        if (json.status === 'success') {
          json.data.run.forEach((r: any) =>
            apiList.push({
              id: r.TxID,
              timestamp: r.Timestamp,
              dept: r.DeptName,
              desc: `${r.Route} (${r.Round})`,
              count: parseInt(r.ItemCount) || 0,
              type: 'run',
              syncStatus: 'synced',
              route: r.Route || 'ไม่ระบุสาย',
              round: r.Round || 'รอบทั่วไป',
            })
          );
          json.data.sort.forEach((r: any) => {
            const normal = parseInt(r.NormalCount) || 0;
            const register = parseInt(r.RegisterCount) || 0;
            const priv = parseInt(r.PrivateCount) || 0;
            apiList.push({
              id: r.TxID,
              timestamp: r.Timestamp,
              dept: r.DeptName,
              desc: `ธรรมดา: ${normal}, ลงทะเบียน: ${register}, ส่วนตัว: ${priv}`,
              count: parseInt(r.Total) || 0,
              type: 'sort',
              syncStatus: 'synced',
              normalCount: normal,
              registerCount: register,
              privateCount: priv,
            });
          });
          json.data.ext.forEach((r: any) =>
            apiList.push({
              id: r.TxID,
              timestamp: r.Timestamp,
              dept: r.RequestingDept,
              desc: `${r.ServiceType} ${r.TrackingNo || ''}`,
              count: parseInt(r.ItemCount) || 0,
              cost: parseInt(r.Cost) || 0,
              type: 'ext',
              fund: r.FundSource,
              syncStatus: 'synced',
            })
          );
        }
      } catch (apiError) {
        console.error('ไม่สามารถโหลดข้อมูลจาก API กำลังโหลดจากแคช:', apiError);
      }

      // 2. ดึงข้อมูลที่ยังไม่ซิงค์จาก IndexedDB
      let localList: LogItem[] = [];
      try {
        const nonSynced = await getNonSyncedLogs();
        localList = nonSynced.map((log: any) => {
          const { type, data, timestamp, syncStatus } = log;
          const { items, common } = data;

          let desc = '';
          let count = 0;
          let cost: number | undefined;
          let fund: string | undefined;
          let route: string | undefined;
          let round: string | undefined;
          let normalCount: number | undefined;
          let registerCount: number | undefined;
          let privateCount: number | undefined;

          if (type === 'run') {
            desc = `${common.route} (${common.round})`;
            count = items.reduce((sum: number, i: any) => sum + (parseInt(i.itemCount) || 0), 0);
            route = common.route || 'ไม่ระบุสาย';
            round = common.round || 'รอบทั่วไป';
          } else if (type === 'sort') {
            const normal = items.reduce((sum: number, i: any) => sum + (parseInt(i.normalCount) || 0), 0);
            const reg = items.reduce((sum: number, i: any) => sum + (parseInt(i.registerCount) || 0), 0);
            const priv = items.reduce((sum: number, i: any) => sum + (parseInt(i.privateCount) || 0), 0);
            desc = `ธรรมดา: ${normal}, ลงทะเบียน: ${reg}, ส่วนตัว: ${priv}`;
            count = items.reduce((sum: number, i: any) => sum + (parseInt(i.total) || 0), 0);
            normalCount = normal;
            registerCount = reg;
            privateCount = priv;
          } else if (type === 'ext') {
            const first = items[0];
            desc = `${first.serviceType} ${first.trackingNo || ''}`;
            count = items.reduce((sum: number, i: any) => sum + (parseInt(i.itemCount) || 0), 0);
            cost = items.reduce((sum: number, i: any) => sum + (parseInt(i.cost) || 0), 0);
            fund = first.fundSource;
          }

          const dateStr = new Date(timestamp).toISOString().replace('T', ' ').substring(0, 19);

          return {
            id: log.id,
            timestamp: dateStr,
            dept: items.length === 1 ? items[0].deptName : `${items.length} หน่วยงาน`,
            desc,
            count,
            cost,
            type,
            fund,
            syncStatus,
            route,
            round,
            normalCount,
            registerCount,
            privateCount,
          };
        });
      } catch (dbError) {
        console.error('ไม่สามารถโหลดข้อมูลจาก IndexedDB:', dbError);
      }

      // 3. กรองข้อมูลในเครื่องตามวันที่
      const dateRange = getDateRange(filters);
      const filteredLocalList = localList.filter((item) => {
        if (filters.type !== 'all' && item.type !== filters.type) return false;
        const itemDate = item.timestamp.split(' ')[0];
        if (dateRange.start && itemDate < dateRange.start) return false;
        if (dateRange.end && itemDate > dateRange.end) return false;
        if (filters.dept && !item.dept.toLowerCase().includes(filters.dept.toLowerCase())) return false;
        return true;
      });

      // 4. รวมรายการและตัดข้อมูลซ้ำ
      const apiIds = new Set(apiList.map(item => item.id));
      const uniqueLocal = filteredLocalList.filter(item => !apiIds.has(item.id));
      const combined = [...uniqueLocal, ...apiList].sort(
        (a, b) => b.timestamp.localeCompare(a.timestamp)
      );
      setLogs(combined);
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', text: 'ไม่สามารถโหลดข้อมูลได้' });
      setTimeout(() => setStatus(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters, currentUser]);

  // ───────────── ลบรายการ ─────────────

  const handleDelete = useCallback(async (id: string, type: string) => {
    setLoading(true);
    try {
      if (id.startsWith('TX-')) {
        await deleteLogLocal(id);
      } else {
        await api.deleteLog(id, type);
      }
      await fetchLogs();
      setStatus({ type: 'success', text: 'ลบรายการเรียบร้อย' });
      setTimeout(() => setStatus(null), 3000);
    } catch {
      setStatus({ type: 'error', text: 'ลบไม่สำเร็จ' });
      setTimeout(() => setStatus(null), 3000);
    } finally {
      setLoading(false);
    }
  }, [currentUser, filters]);

  // ───────────── คัดลอกรายงานสรุป ─────────────

  const copyReport = () => {
    const runStats = logs.filter(l => l.type === 'run');
    const sortStats = logs.filter(l => l.type === 'sort');
    const extStats = logs.filter(l => l.type === 'ext');

    const unique = (arr: LogItem[]) =>
      new Set(arr.map(i => getRealOwner(i.dept, masterData?.departments))).size;
    const sum = (arr: LogItem[]) =>
      arr.reduce((acc, curr) => acc + (curr.count || 0), 0);
    const sumCost = (arr: LogItem[]) =>
      arr.reduce((acc, curr) => acc + (curr.cost || 0), 0);
    const runTotal = sum(runStats);

    let dateLabel = '';
    const now = new Date();
    if (filters.dateMode === 'today') {
      const formattedDate = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
      dateLabel = `(วันที่ ${formattedDate})`;
    } else if (filters.dateMode === 'month') {
      const formattedDate = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
      dateLabel = `(ประจำเดือน${formattedDate})`;
    } else if (filters.dateMode === 'fiscal') {
      const fiscalYear = now.getMonth() >= 9 ? now.getFullYear() + 543 + 1 : now.getFullYear() + 543;
      dateLabel = `(ประจำปีงบประมาณ ${fiscalYear})`;
    } else {
      try {
        const start = new Date(filters.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const end = new Date(filters.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        dateLabel = `(วันที่ ${start} - ${end})`;
      } catch (e) {
        dateLabel = '';
      }
    }

    const text = `สรุปผลการดำเนินงาน ${dateLabel}

งานบริการรับ-ส่งเอกสารภายใน:
- ให้บริการ ${unique(runStats)} หน่วยงาน (${runTotal.toLocaleString()} ซอง)
- ประหยัดงบประมาณ ${(runTotal * RUN_SAVING_PER_UNIT).toLocaleString()} บาท

งานบริการคัดแยก-นำจ่ายไปรษณีย์ภัณฑ์:
- ให้บริการ ${unique(sortStats)} หน่วยงาน (${sum(sortStats).toLocaleString()} ชิ้น)

งานบริการนำส่งไปรษณีย์ภัณฑ์ภายนอก:
- ให้บริการ ${unique(extStats)} หน่วยงาน (${sum(extStats).toLocaleString()} ชิ้น)
- ค่าใช้จ่ายรวม ${sumCost(extStats).toLocaleString()} บาท`;

    navigator.clipboard.writeText(text);
    setStatus({ type: 'success', text: 'คัดลอกรายงานสรุปแล้ว' });
    setTimeout(() => setStatus(null), 3000);
  };

  const copyPublicLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?view=public`;
    navigator.clipboard.writeText(url);
    setCopiedPublicLink(true);
    setStatus({ type: 'success', text: 'คัดลอกลิงก์ตรวจสอบสาธารณะแล้ว' });
    setTimeout(() => {
      setCopiedPublicLink(false);
      setStatus(null);
    }, 2000);
  };

  // ───────────── แท็บ ─────────────

  const tabs: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
    { id: 'list',  label: 'รายการข้อมูล',   icon: <ListFilter size={14} /> },
    { id: 'run',   label: 'รับ-ส่งภายใน',   icon: <TrendingUp size={14} /> },
    { id: 'sort',  label: 'คัดแยก-นำจ่าย',  icon: <Mail size={14} /> },
    { id: 'ext',   label: 'นำส่งภายนอก',    icon: <Package size={14} /> },
  ];

  // ───────────── Render ─────────────

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* แท็บ + ปุ่มสรุป */}
      <div className="flex flex-col gap-4">
        <div
          className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto"
          role="tablist"
          aria-label="ประเภทรายงาน"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setReportTab(tab.id)}
              role="tab"
              aria-selected={reportTab === tab.id}
              aria-controls={`report-panel-${tab.id}`}
              id={`report-tab-${tab.id}`}
              className={cn(
                'flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none',
                reportTab === tab.id
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={copyPublicLink}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-purple-600 dark:text-purple-400 dark:hover:text-purple-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/5 shadow-lg shadow-slate-950/5 dark:shadow-slate-950/20 transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none"
            aria-label="คัดลอกลิงก์ตรวจสอบสาธารณะ"
          >
            <Link size={14} aria-hidden="true" />
            {copiedPublicLink ? 'คัดลอกลิงก์แล้ว!' : 'คัดลอกลิงก์สาธารณะ'}
          </button>
          <button
            onClick={copyReport}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-900/20 transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none"
            aria-label="คัดลอกสรุปรายงานไปยังคลิปบอร์ด"
          >
            <Copy size={14} aria-hidden="true" />
            คัดลอกสรุป
          </button>
        </div>
      </div>

      {/* ตัวกรองช่วงเวลา */}
      <ReportFilters />

      {/* เนื้อหาตามแท็บ */}
      <div
        role="tabpanel"
        id={`report-panel-${reportTab}`}
        aria-labelledby={`report-tab-${reportTab}`}
      >
        {reportTab === 'list' && (
          <div className="space-y-3">
            {logs.map((log) => (
              <GlassCard key={log.id} className="hover:border-white/20 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'p-2 rounded-xl',
                        log.type === 'run' ? 'bg-blue-600 text-white'
                        : log.type === 'sort' ? 'bg-orange-600 text-white'
                        : 'bg-emerald-500 text-slate-950'
                      )}
                      aria-hidden="true"
                    >
                      {log.type === 'run' && <TrendingUp size={16} />}
                      {log.type === 'sort' && <Mail size={16} />}
                      {log.type === 'ext' && <Package size={16} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">{log.dept}</h4>
                        {log.syncStatus === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] text-slate-600 dark:text-slate-300 font-semibold">
                            <CloudOff size={10} className="text-slate-600 dark:text-slate-300" aria-hidden="true" />
                            ออฟไลน์
                          </span>
                        )}
                        {log.syncStatus === 'syncing' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 rounded text-[9px] text-purple-700 dark:text-purple-300 font-semibold">
                            <RefreshCw size={10} className="text-purple-700 dark:text-purple-300 animate-spin" aria-hidden="true" />
                            กำลังซิงค์
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">{log.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">{log.count}</span>
                      <span className="text-[8px] text-slate-600 dark:text-slate-400 block">ชิ้น</span>
                    </div>
                    <button
                      onClick={() => setDeleteTarget({ id: log.id, type: log.type, dept: log.dept })}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none rounded-lg"
                      aria-label={`ลบรายการ ${log.dept}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))}
            {logs.length === 0 && (
              <div className="py-20 text-center space-y-4" role="status">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-white/5">
                  <Search size={24} className="text-slate-600" aria-hidden="true" />
                </div>
                <p className="text-slate-500 text-sm font-medium">
                  ไม่พบข้อมูลในช่วงเวลาที่เลือก
                </p>
              </div>
            )}
          </div>
        )}

        {reportTab === 'run' && <RunReport logs={logs} />}
        {reportTab === 'sort' && <SortReport logs={logs} />}
        {reportTab === 'ext' && <ExtReport logs={logs} />}
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onConfirm={() => {
          if (deleteTarget) {
            handleDelete(deleteTarget.id, deleteTarget.type);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
        title="ยืนยันการลบรายการ"
        description={`คุณแน่ใจหรือไม่ว่าต้องการลบรายการ${deleteTarget?.dept ? ` ของ "${deleteTarget.dept}"` : 'นี้'}? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
        confirmLabel="ลบรายการ"
        cancelLabel="ยกเลิก"
        variant="danger"
      />
    </div>
  );
};
