import { Department } from '../types';
import { FUND_SOURCES, normalizeFundSource } from './fundSource';
import { getBudgetOwnerEffective, getDeptDisplay } from './helpers';

export type SelfServiceQueryMode = 'department' | 'budget_owner';

export type SelfServiceLogAction = 'self_service_otp_verified' | 'self_service_search' | 'self_service_error' | 'self_service_export';

export type SelfServiceErrorLogInput = {
  email?: string;
  queryText?: string;
  queryMode?: SelfServiceQueryMode;
  selectedDeptName?: string;
  budgetOwner?: string;
  matchedDeptCount?: number;
  dateMode?: string;
  startDate?: string;
  endDate?: string;
  fiscalYear?: string;
  userAgent?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type SelfServiceLogPayload = {
  email: string;
  action: SelfServiceLogAction;
  queryText: string;
  queryMode: SelfServiceQueryMode | '';
  selectedDeptName: string;
  budgetOwnerEffective: string;
  matchedDeptCount: number;
  dateMode: string;
  startDate: string;
  endDate: string;
  fiscalYear: string;
  resultCountRun?: number;
  resultCountSort?: number;
  resultCountExt?: number;
  exportFormat?: string;
  trackingMode?: string;
  status: 'success' | 'error';
  userAgent: string;
  errorCode: string;
  errorMessage: string;
};

const limitText = (value: unknown, maxLength: number) => String(value || '').trim().slice(0, maxLength);

export const summarizeUserAgent = (userAgent?: string) => {
  const value = String(userAgent || '').toLowerCase();
  const browser = value.includes('edg/')
    ? 'Edge'
    : value.includes('chrome/')
      ? 'Chrome'
      : value.includes('firefox/')
        ? 'Firefox'
        : value.includes('safari/')
          ? 'Safari'
          : 'Unknown';
  const os = value.includes('windows')
    ? 'Windows'
    : value.includes('iphone') || value.includes('ipad') || value.includes('ios')
      ? 'iOS'
      : value.includes('android')
        ? 'Android'
        : value.includes('mac os')
          ? 'macOS'
          : value.includes('linux')
            ? 'Linux'
            : 'Unknown';

  return `${browser} / ${os}`;
};

export const buildSelfServiceErrorLogPayload = (input: SelfServiceErrorLogInput): SelfServiceLogPayload => ({
  email: limitText(input.email, 160).toLowerCase(),
  action: 'self_service_error',
  queryText: limitText(input.queryText, 120),
  queryMode: input.queryMode || '',
  selectedDeptName: limitText(input.selectedDeptName, 160),
  budgetOwnerEffective: limitText(input.budgetOwner, 160),
  matchedDeptCount: Number(input.matchedDeptCount || 0),
  dateMode: limitText(input.dateMode, 40),
  startDate: limitText(input.startDate, 20),
  endDate: limitText(input.endDate, 20),
  fiscalYear: limitText(input.fiscalYear, 10),
  status: 'error',
  userAgent: summarizeUserAgent(input.userAgent),
  errorCode: limitText(input.errorCode, 60),
  errorMessage: limitText(input.errorMessage, 200),
});

export const resolveSelfServiceSelection = (
  departments: Department[],
  selectedText: string,
  mode: SelfServiceQueryMode,
) => {
  const selectedDept = departments.find((dept) => (
    dept.DeptName === selectedText || getDeptDisplay(dept) === selectedText
  ));

  if (!selectedDept) return null;

  const budgetOwner = getBudgetOwnerEffective(selectedDept);
  const matchedDepartments = mode === 'budget_owner'
    ? departments.filter((dept) => getBudgetOwnerEffective(dept) === budgetOwner).map((dept) => dept.DeptName)
    : [selectedDept.DeptName];

  return {
    queryMode: mode,
    deptName: selectedDept.DeptName,
    budgetOwner,
    matchedDepartments,
  };
};

export const maskTrackingNumber = (tracking?: string | null) => {
  const value = String(tracking || '').trim();
  if (!value || value === '-') return '-';
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 5)}***${value.slice(-4)}`;
};

export const summarizePublicExtByFund = (items: Array<{ fund?: string; count?: number; cost?: number }>) => {
  const summary = FUND_SOURCES.reduce((acc, fund) => {
    acc[fund] = { items: 0, cost: 0 };
    return acc;
  }, {} as Record<string, { items: number; cost: number }>);

  items.forEach((item) => {
    const fund = normalizeFundSource(item.fund);
    summary[fund].items += Number(item.count || 0);
    summary[fund].cost += Number(item.cost || 0);
  });

  return summary;
};

const safeFilePart = (value: string) => value
  .replace(/[\\/:*?"<>|]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 80);

export const buildSelfServiceExportFileName = (deptName: string, startDate: string, endDate: string) => (
  `DCG-Self-Service_${safeFilePart(deptName || 'department')}_${startDate}_${endDate}.xlsx`
);

export type SelfServiceExportInput = {
  email: string;
  deptName: string;
  queryMode: SelfServiceQueryMode;
  budgetOwner: string;
  matchedDeptCount: number;
  startDate: string;
  endDate: string;
  fiscalYear: string;
  exportedAt: string;
  runData: any[];
  sortData: any[];
  extData: any[];
};

export const buildSelfServiceExportSheets = (input: SelfServiceExportInput) => ({
  summary: [
    ['รายการ', 'ค่า'],
    ['อีเมลผู้ export', input.email],
    ['หน่วยงานที่เลือก', input.deptName],
    ['โหมดค้นหา', input.queryMode === 'budget_owner' ? 'รวมต้นสังกัดงบประมาณ' : 'เฉพาะหน่วยงานที่เลือก'],
    ['ต้นสังกัดงบประมาณ', input.budgetOwner],
    ['จำนวนหน่วยงานที่รวม', input.matchedDeptCount],
    ['วันที่เริ่มต้น', input.startDate],
    ['วันที่สิ้นสุด', input.endDate],
    ['ปีงบประมาณ', input.fiscalYear],
    ['จำนวนรับ-ส่งภายใน', input.runData.length],
    ['จำนวนคัดแยก-นำจ่าย', input.sortData.length],
    ['จำนวนนำส่งภายนอก', input.extData.length],
    ['วันที่ export', input.exportedAt],
    ['หมายเหตุ', 'ข้อมูลนี้จัดทำจากระบบ DCG Smart Service สำหรับตรวจสอบภายในหน่วยงาน ห้ามเผยแพร่ต่อสาธารณะโดยไม่ได้รับอนุญาต'],
  ],
  run: [
    ['วันที่', 'หน่วยงาน', 'สายส่ง', 'รอบ', 'จำนวนซองเอกสาร', 'หมายเหตุ'],
    ...input.runData.map((item) => [
      item.date || '',
      item.dept || input.deptName,
      item.route || '',
      item.round || '',
      item.count || 0,
      item.note || '',
    ]),
  ],
  sort: [
    ['วันที่', 'หน่วยงาน', 'จดหมายธรรมดา', 'จดหมายลงทะเบียน', 'ไปรษณีย์ภัณฑ์ส่วนตัว', 'รวม', 'หมายเหตุ'],
    ...input.sortData.map((item) => [
      item.date || '',
      item.dept || input.deptName,
      item.normal || 0,
      item.register || 0,
      item.private || 0,
      item.total || 0,
      item.note || '',
    ]),
  ],
  ext: [
    ['วันที่', 'หน่วยงาน', 'บริการ', 'จำนวน', 'ค่าบริการ', 'แหล่งงบประมาณ', 'Tracking (masked)'],
    ...input.extData.map((item) => [
      item.date || '',
      item.dept || input.deptName,
      item.service || '',
      item.count || 0,
      item.cost || 0,
      item.fund || '',
      maskTrackingNumber(item.tracking),
    ]),
  ],
});
