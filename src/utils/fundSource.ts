import { LogItem } from '../types';

export const DEFAULT_FUND_SOURCE = 'งบประมาณมหาวิทยาลัย';

export const FUND_SOURCES = [
  DEFAULT_FUND_SOURCE,
  'งบประมาณโครงการ',
  'งบประมาณวิสาหกิจ',
] as const;

type FundSource = typeof FUND_SOURCES[number];

type FundSummary = Record<FundSource, { items: number; cost: number; depts: Set<string> }>;

const FUND_SOURCE_ALIASES: Record<string, FundSource> = {
  'งบประมาณส่วนกลาง': 'งบประมาณมหาวิทยาลัย',
  'งบประมาณมหาวิทยาลัย': 'งบประมาณมหาวิทยาลัย',
  'งบโครงการ': 'งบประมาณโครงการ',
  'งบประมาณโครงการ': 'งบประมาณโครงการ',
  'งบวิสาหกิจ': 'งบประมาณวิสาหกิจ',
  'งบประมาณวิสาหกิจ': 'งบประมาณวิสาหกิจ',
};

export const normalizeFundSource = (fundSource?: string | null): FundSource => {
  const key = String(fundSource ?? '').trim();
  return FUND_SOURCE_ALIASES[key] || DEFAULT_FUND_SOURCE;
};

export const createEmptyFundSummary = (): FundSummary => (
  FUND_SOURCES.reduce((acc, fund) => {
    acc[fund] = { items: 0, cost: 0, depts: new Set<string>() };
    return acc;
  }, {} as FundSummary)
);

export const summarizeFundsBySource = (logs: LogItem[]): FundSummary => {
  const summary = createEmptyFundSummary();

  logs.forEach((log) => {
    if (log.type !== 'ext') return;

    const fund = normalizeFundSource(log.fund);
    summary[fund].items += log.count || 0;
    summary[fund].cost += log.cost || 0;
    summary[fund].depts.add(log.dept);
  });

  return summary;
};
