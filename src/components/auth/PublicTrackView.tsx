import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../services/api';
import { Search, MapPin, Inbox, Globe, ArrowLeft, Link, Mail, ShieldCheck, AlertCircle, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import SmartSearchInput from '../common/SmartSearchInput';
import {
  SelfServiceQueryMode,
  buildSelfServiceErrorLogPayload,
  buildSelfServiceExportFileName,
  buildSelfServiceExportSheets,
  buildSelfServicePrintHtml,
  maskTrackingNumber,
  resolveSelfServiceSelection,
  summarizeUserAgent,
  summarizePublicExtByFund,
} from '../../utils/selfService';

interface PublicTrackViewProps {
  onBack: () => void;
  initialDept?: string;
}

type ServiceTab = 'run' | 'sort' | 'ext';

const SELF_SERVICE_TOKEN_KEY = 'dcg_self_service_session_token';
const SELF_SERVICE_EMAIL_KEY = 'dcg_self_service_email';
const SELF_SERVICE_EXPORT_COUNT_KEY = 'dcg_self_service_export_count';

const formatDateLocal = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const PublicTrackView: React.FC<PublicTrackViewProps> = ({ onBack, initialDept }) => {
  const { masterData, setMasterData, setLoading } = useAppStore();
  const [publicSearchDept, setPublicSearchDept] = useState('');
  const [selfServiceEmail, setSelfServiceEmail] = useState(() => localStorage.getItem(SELF_SERVICE_EMAIL_KEY) || '');
  const [selfServiceToken, setSelfServiceToken] = useState(() => localStorage.getItem(SELF_SERVICE_TOKEN_KEY) || '');
  const [selfServiceOtpCode, setSelfServiceOtpCode] = useState('');
  const [selfServiceOtpSent, setSelfServiceOtpSent] = useState(false);
  const [selfServiceCooldown, setSelfServiceCooldown] = useState(0);
  const [selfServiceMessage, setSelfServiceMessage] = useState('');
  const [selfServiceError, setSelfServiceError] = useState('');
  const [queryMode, setQueryMode] = useState<SelfServiceQueryMode>('department');
  const [selectedContext, setSelectedContext] = useState<ReturnType<typeof resolveSelfServiceSelection>>(null);
  const [activeTab, setActiveTab] = useState<ServiceTab>('run');
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [exportCount, setExportCount] = useState(() => Number(sessionStorage.getItem(SELF_SERVICE_EXPORT_COUNT_KEY) || 0));
  
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
  const currentDateMode = isToday ? 'today' : isMonth ? 'month' : isFiscal ? 'fiscal_year' : 'custom';
  const fiscalYearLabel = String(fiscalYear + 544);

  React.useEffect(() => {
    if (selfServiceCooldown <= 0) return;
    const timer = window.setTimeout(() => setSelfServiceCooldown(selfServiceCooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [selfServiceCooldown]);

  React.useEffect(() => {
    if (masterData?.departments?.length) return;

    let cancelled = false;
    api.fetchPublicMetaData()
      .then((json) => {
        if (cancelled || json.status !== 'success') return;
        setMasterData({
          users: [],
          departments: json.data?.departments || [],
          services: json.data?.services || [],
        });
      })
      .catch((err) => {
        console.warn('Failed to fetch public metadata:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [masterData, setMasterData]);

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
  const filteredRunData = filterByDateRange(runData);
  const filteredSortData = filterByDateRange(sortData);
  const filteredExtData = filterByDateRange(extData);
  const extFundSummary = summarizePublicExtByFund(filteredExtData);

  const handleRequestSelfServiceOTP = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    setSelfServiceError('');
    setSelfServiceMessage('');

    const trimmedEmail = selfServiceEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setSelfServiceError('กรุณากรอกอีเมลสำหรับรับรหัส OTP');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setSelfServiceError('กรุณากรอกรูปแบบอีเมลให้ถูกต้อง');
      return;
    }

    setLoading(true);
    try {
      const res = await api.requestSelfServiceOTP(trimmedEmail);
      setSelfServiceOtpSent(true);
      setSelfServiceCooldown(60);
      setSelfServiceMessage(res.data?.message || `ส่งรหัส OTP ไปยัง ${trimmedEmail} แล้ว`);
    } catch (err: any) {
      setSelfServiceError(err.message || 'ไม่สามารถขอรหัส OTP ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySelfServiceOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setSelfServiceError('');
    setSelfServiceMessage('');

    const trimmedEmail = selfServiceEmail.trim().toLowerCase();
    const trimmedCode = selfServiceOtpCode.trim();
    if (!trimmedCode) {
      setSelfServiceError('กรุณากรอกรหัส OTP 6 หลัก');
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifySelfServiceOTP(trimmedEmail, trimmedCode);
      const token = res.data?.sessionToken;
      if (!token) {
        throw new Error('ไม่พบ session สำหรับ self-service จากระบบ');
      }
      localStorage.setItem(SELF_SERVICE_TOKEN_KEY, token);
      localStorage.setItem(SELF_SERVICE_EMAIL_KEY, trimmedEmail);
      setSelfServiceToken(token);
      setSelfServiceEmail(trimmedEmail);
      setSelfServiceMessage('ยืนยันตัวตนสำเร็จ สามารถค้นหาข้อมูลหน่วยงานได้แล้ว');
    } catch (err: any) {
      setSelfServiceError(err.message || 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ');
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (dept: string) => {
    if (!dept) return;
    if (!selfServiceToken) {
      toast.warning('กรุณายืนยันตัวตนด้วย OTP ก่อนค้นหาข้อมูล');
      return;
    }
    const selection = resolveSelfServiceSelection(masterData?.departments || [], dept, queryMode);
    if (!selection) {
      toast.warning('กรุณาเลือกหน่วยงานจากรายการที่ระบบแนะนำก่อนดูรายงาน');
      return;
    }

    setLoading(true);
    setHasSearched(false);
    
    try {
      const json = await api.publicSearch(selection.deptName, selfServiceToken, {
        queryMode: selection.queryMode,
        budgetOwner: selection.budgetOwner,
        matchedDepartments: selection.matchedDepartments,
        dateMode: currentDateMode,
        startDate: publicStartDate,
        endDate: publicEndDate,
        fiscalYear: fiscalYearLabel,
        userAgent: summarizeUserAgent(navigator.userAgent),
      });
      if (json.status === 'success') {
        const rawData = json.data;
        setSelectedContext(selection);
        
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
        api.logSelfServiceEvent(buildSelfServiceErrorLogPayload({
          email: selfServiceEmail,
          queryText: dept,
          queryMode,
          selectedDeptName: selection.deptName,
          budgetOwner: selection.budgetOwner,
          matchedDeptCount: selection.matchedDepartments.length,
          dateMode: currentDateMode,
          startDate: publicStartDate,
          endDate: publicEndDate,
          fiscalYear: fiscalYearLabel,
          userAgent: navigator.userAgent,
          errorCode: 'SEARCH_ERROR_RESPONSE',
          errorMessage: json.message || 'Self-service search returned an error response',
        }), selfServiceToken);
        toast.error('เกิดข้อผิดพลาด', {
          description: json.message || 'ไม่สามารถดึงข้อมูลได้',
        });
      }
    } catch (e: any) {
      console.error(e);
      api.logSelfServiceEvent(buildSelfServiceErrorLogPayload({
        email: selfServiceEmail,
        queryText: dept,
        queryMode,
        selectedDeptName: selection.deptName,
        budgetOwner: selection.budgetOwner,
        matchedDeptCount: selection.matchedDepartments.length,
        dateMode: currentDateMode,
        startDate: publicStartDate,
        endDate: publicEndDate,
        fiscalYear: fiscalYearLabel,
        userAgent: navigator.userAgent,
        errorCode: 'SEARCH_FAILED',
        errorMessage: String(e.message || e),
      }), selfServiceToken);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ', {
        description: String(e.message || e),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!hasSearched || !selectedContext) {
      toast.warning('กรุณาค้นหาข้อมูลก่อน export');
      return;
    }
    if (exportCount >= 10) {
      toast.warning('export ครบ 10 ครั้งใน session นี้แล้ว กรุณายืนยัน OTP ใหม่หรือ refresh หน้า');
      return;
    }

    const exportUsesArchive = [...filteredRunData, ...filteredSortData, ...filteredExtData]
      .some((item: any) => item.sourceType === 'archive');
    const payloadBase = {
      email: selfServiceEmail,
      queryText: selectedContext.deptName,
      queryMode: selectedContext.queryMode,
      selectedDeptName: selectedContext.deptName,
      budgetOwnerEffective: selectedContext.budgetOwner,
      matchedDeptCount: selectedContext.matchedDepartments.length,
      dateMode: currentDateMode,
      startDate: publicStartDate,
      endDate: publicEndDate,
      fiscalYear: fiscalYearLabel,
      resultCountRun: filteredRunData.length,
      resultCountSort: filteredSortData.length,
      resultCountExt: filteredExtData.length,
      exportFormat: 'xlsx',
      trackingMode: exportUsesArchive ? 'masked_archive' : 'masked',
      userAgent: summarizeUserAgent(navigator.userAgent),
    };

    try {
      const sheets = buildSelfServiceExportSheets({
        email: selfServiceEmail,
        deptName: selectedContext.deptName,
        queryMode: selectedContext.queryMode,
        budgetOwner: selectedContext.budgetOwner,
        matchedDeptCount: selectedContext.matchedDepartments.length,
        startDate: publicStartDate,
        endDate: publicEndDate,
        fiscalYear: fiscalYearLabel,
        exportedAt: new Date().toLocaleString('th-TH'),
        runData: filteredRunData,
        sortData: filteredSortData,
        extData: filteredExtData,
      });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheets.summary), 'สรุป');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheets.run), 'รับ-ส่งภายใน');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheets.sort), 'คัดแยก-นำจ่าย');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheets.ext), 'นำส่งภายนอก');
      XLSX.writeFile(workbook, buildSelfServiceExportFileName(selectedContext.deptName, publicStartDate, publicEndDate));

      const nextExportCount = exportCount + 1;
      setExportCount(nextExportCount);
      sessionStorage.setItem(SELF_SERVICE_EXPORT_COUNT_KEY, String(nextExportCount));
      api.logSelfServiceEvent({
        ...payloadBase,
        action: 'self_service_export',
        status: 'success',
        errorCode: '',
        errorMessage: '',
      }, selfServiceToken);
      toast.success('export Excel สำเร็จ');
    } catch (err: any) {
      api.logSelfServiceEvent({
        ...payloadBase,
        action: 'self_service_export',
        status: 'error',
        errorCode: 'EXPORT_FAILED',
        errorMessage: String(err.message || err),
      }, selfServiceToken);
      toast.error('export Excel ไม่สำเร็จ', {
        description: String(err.message || err),
      });
    }
  };

  const handlePrintReport = async () => {
    if (!hasSearched || !selectedContext) {
      toast.warning('เธเธฃเธธเธ“เธฒเธเนเธเธซเธฒเธเนเธญเธกเธนเธฅเธเนเธญเธ print');
      return;
    }

    const exportUsesArchive = [...filteredRunData, ...filteredSortData, ...filteredExtData]
      .some((item: any) => item.sourceType === 'archive');
    const payloadBase = {
      email: selfServiceEmail,
      queryText: selectedContext.deptName,
      queryMode: selectedContext.queryMode,
      selectedDeptName: selectedContext.deptName,
      budgetOwnerEffective: selectedContext.budgetOwner,
      matchedDeptCount: selectedContext.matchedDepartments.length,
      dateMode: currentDateMode,
      startDate: publicStartDate,
      endDate: publicEndDate,
      fiscalYear: fiscalYearLabel,
      resultCountRun: filteredRunData.length,
      resultCountSort: filteredSortData.length,
      resultCountExt: filteredExtData.length,
      exportFormat: 'print',
      trackingMode: exportUsesArchive ? 'masked_archive' : 'masked',
      userAgent: summarizeUserAgent(navigator.userAgent),
    };

    try {
      const printWindow = window.open('', '_blank', 'width=1024,height=768');
      if (!printWindow) {
        throw new Error('POPUP_BLOCKED');
      }
      printWindow.opener = null;

      printWindow.document.open();
      printWindow.document.write(buildSelfServicePrintHtml({
        email: selfServiceEmail,
        deptName: selectedContext.deptName,
        queryMode: selectedContext.queryMode,
        budgetOwner: selectedContext.budgetOwner,
        matchedDeptCount: selectedContext.matchedDepartments.length,
        startDate: publicStartDate,
        endDate: publicEndDate,
        fiscalYear: fiscalYearLabel,
        exportedAt: new Date().toLocaleString('th-TH'),
        runData: filteredRunData,
        sortData: filteredSortData,
        extData: filteredExtData,
      }));
      printWindow.document.close();

      api.logSelfServiceEvent({
        ...payloadBase,
        action: 'self_service_export',
        status: 'success',
        errorCode: '',
        errorMessage: '',
      }, selfServiceToken);
    } catch (err: any) {
      api.logSelfServiceEvent({
        ...payloadBase,
        action: 'self_service_export',
        status: 'error',
        errorCode: 'PRINT_FAILED',
        errorMessage: String(err.message || err),
      }, selfServiceToken);
      toast.error('print report เนเธกเนเธชเธณเน€เธฃเนเธ', {
        description: String(err.message || err),
      });
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
      if (selfServiceToken) {
        performSearch(decodedDept);
      }
    }
  }, [initialDept, selfServiceToken]);

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
        {!selfServiceToken && (
          <div className="mb-5 space-y-4 rounded-2xl border border-purple-200 bg-purple-50/70 p-4 text-left dark:border-purple-500/20 dark:bg-purple-950/20">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-600 dark:text-purple-300" />
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">ยืนยันตัวตนก่อนตรวจสอบข้อมูล</h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  ใช้อีเมลของท่านเพื่อรับรหัส OTP แล้วจึงค้นหาการใช้บริการของหน่วยงานได้
                </p>
              </div>
            </div>

            {!selfServiceOtpSent ? (
              <form onSubmit={handleRequestSelfServiceOTP} className="space-y-3">
                <div className="relative">
                  <input
                    type="email"
                    value={selfServiceEmail}
                    onChange={(e) => setSelfServiceEmail(e.target.value)}
                    placeholder="กรอกอีเมลเพื่อรับ OTP"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm text-slate-800 outline-none transition-shadow focus:ring-2 focus:ring-purple-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
                  />
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-purple-600 px-4 py-3 text-xs font-bold text-white transition-all hover:bg-purple-700 active:scale-95"
                >
                  ขอรหัส OTP
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifySelfServiceOTP} className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={selfServiceOtpCode}
                  onChange={(e) => setSelfServiceOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="กรอกรหัส 6 หลัก"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-lg font-black tracking-[0.4em] text-slate-900 outline-none transition-shadow focus:ring-2 focus:ring-purple-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-purple-600 px-4 py-3 text-xs font-bold text-white transition-all hover:bg-purple-700 active:scale-95"
                >
                  ยืนยัน OTP
                </button>
                <div className="text-center">
                  {selfServiceCooldown > 0 ? (
                    <p className="text-[10px] font-semibold text-slate-500">ขอรหัสใหม่ได้ในอีก {selfServiceCooldown} วินาที</p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestSelfServiceOTP}
                      className="rounded px-2 py-1 text-[10px] font-bold text-purple-600 hover:underline dark:text-purple-300"
                    >
                      ส่งรหัส OTP อีกครั้ง
                    </button>
                  )}
                </div>
              </form>
            )}

            {selfServiceError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{selfServiceError}</span>
              </div>
            )}
            {selfServiceMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                {selfServiceMessage}
              </div>
            )}
          </div>
        )}
        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest block">
          หน่วยงานของท่าน
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setQueryMode('department')}
            className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition-all ${
              queryMode === 'department'
                ? 'border-purple-500 bg-purple-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300'
            }`}
          >
            เฉพาะหน่วยงานที่เลือก
          </button>
          <button
            type="button"
            onClick={() => setQueryMode('budget_owner')}
            className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition-all ${
              queryMode === 'budget_owner'
                ? 'border-purple-500 bg-purple-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300'
            }`}
          >
            รวมต้นสังกัดงบประมาณ
          </button>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <SmartSearchInput
              value={publicSearchDept}
              onChange={(value) => {
                setPublicSearchDept(value);
                setSelectedContext(null);
              }}
              placeholder="พิมพ์ชื่อหน่วยงานของท่าน..."
              departments={masterData?.departments || []}
              themeColor="text-purple-500"
            />
          </div>
          <button
            onClick={handlePublicSearch}
            disabled={!selfServiceToken}
            className="px-5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md shadow-purple-950/10 dark:shadow-none flex items-center gap-2 transition-all active:scale-95 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search size={16} /> ค้นหา
          </button>
        </div>
        {hasSearched && (
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              onClick={handleExportExcel}
              disabled={!selectedContext || exportCount >= 10}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-[10px] font-bold border border-emerald-200 dark:border-emerald-500/20 transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={12} />
              Export Excel ({exportCount}/10)
            </button>
            <button
              onClick={handlePrintReport}
              disabled={!selectedContext}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 dark:bg-slate-800/40 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-bold border border-slate-200 dark:border-white/5 transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer size={12} />
              Print Report
            </button>
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
          {selectedContext && (
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-3.5 text-left text-xs text-slate-700 dark:border-white/5 dark:bg-slate-900/40 dark:text-slate-300">
              <div className="font-extrabold text-slate-900 dark:text-white">
                {selectedContext.queryMode === 'budget_owner'
                  ? `ต้นสังกัดงบประมาณ: ${selectedContext.budgetOwner}`
                  : `หน่วยงาน: ${selectedContext.deptName}`}
              </div>
              {selectedContext.queryMode === 'budget_owner' && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedContext.matchedDepartments.map((deptName) => (
                    <span
                      key={deptName}
                      className="rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-bold text-purple-700 dark:bg-purple-500/10 dark:text-purple-200"
                    >
                      {deptName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
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
                {filteredExtData.length > 0 ? (
                  <>
                    <div className="mb-3 grid gap-2">
                      {Object.entries(extFundSummary).map(([fundName, data]) => (
                        <div
                          key={fundName}
                          className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs dark:border-emerald-500/20 dark:bg-emerald-500/10"
                        >
                          <div className="font-bold text-emerald-700 dark:text-emerald-200">{fundName}</div>
                          <div className="mt-0.5 text-slate-600 dark:text-slate-300">
                            {data.items.toLocaleString()} ชิ้น · {data.cost.toLocaleString()} บาท
                          </div>
                        </div>
                      ))}
                    </div>
                    {filteredExtData.map((item, idx) => (
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
                        <div>• <strong>หมายเลขติดตาม (Tracking):</strong> <span className="text-slate-700 dark:text-slate-300 font-mono">{maskTrackingNumber(item.tracking)}</span></div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 pt-1">• <strong>วันที่บันทึก:</strong> {item.date}</div>
                      </div>
                    </div>
                    ))}
                  </>
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
