import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FUND_SOURCE,
  FUND_SOURCES,
  normalizeFundSource,
  summarizeFundsBySource,
} from './fundSource';
import { LogItem } from '../types';

describe('fundSource utilities', () => {
  it('normalizes old and current Thai fund source labels into the three official groups', () => {
    expect(normalizeFundSource('งบประมาณส่วนกลาง')).toBe('งบประมาณมหาวิทยาลัย');
    expect(normalizeFundSource('งบประมาณมหาวิทยาลัย')).toBe('งบประมาณมหาวิทยาลัย');
    expect(normalizeFundSource('งบโครงการ')).toBe('งบประมาณโครงการ');
    expect(normalizeFundSource('งบประมาณโครงการ')).toBe('งบประมาณโครงการ');
    expect(normalizeFundSource('งบวิสาหกิจ')).toBe('งบประมาณวิสาหกิจ');
    expect(normalizeFundSource('งบประมาณวิสาหกิจ')).toBe('งบประมาณวิสาหกิจ');
  });

  it('falls back blank or unknown values to the university budget group so reports always stay in three groups', () => {
    expect(normalizeFundSource('')).toBe(DEFAULT_FUND_SOURCE);
    expect(normalizeFundSource(undefined)).toBe(DEFAULT_FUND_SOURCE);
    expect(normalizeFundSource('งบอื่นที่ไม่อยู่ใน mapping')).toBe(DEFAULT_FUND_SOURCE);
  });

  it('summarizes external-post logs into all three official fund groups', () => {
    const logs: LogItem[] = [
      extLog({ fund: 'งบประมาณส่วนกลาง', count: 2, cost: 90, dept: 'A' }),
      extLog({ fund: 'งบโครงการ', count: 3, cost: 150, dept: 'B' }),
      extLog({ fund: 'งบประมาณโครงการ', count: 1, cost: 50, dept: 'B' }),
    ];

    const summary = summarizeFundsBySource(logs);

    expect(Object.keys(summary)).toEqual(FUND_SOURCES);
    expect(summary['งบประมาณมหาวิทยาลัย']).toMatchObject({ items: 2, cost: 90 });
    expect(summary['งบประมาณโครงการ']).toMatchObject({ items: 4, cost: 200 });
    expect(summary['งบประมาณวิสาหกิจ']).toMatchObject({ items: 0, cost: 0 });
    expect(summary['งบประมาณโครงการ'].depts.size).toBe(1);
  });
});

const extLog = ({
  fund,
  count,
  cost,
  dept,
}: {
  fund?: string;
  count: number;
  cost: number;
  dept: string;
}): LogItem => ({
  id: `${dept}-${fund || 'blank'}`,
  timestamp: '2026-06-10 10:00:00',
  dept,
  desc: 'EMS RL123456789TH',
  count,
  cost,
  type: 'ext',
  fund,
  syncStatus: 'synced',
});
