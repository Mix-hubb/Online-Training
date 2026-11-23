// API: partner portal (own data only).
import { download, get, qs } from './client';
import type { Payout, RevenuePoint, RevenueRow, RevenueTotals } from '@/types';

export interface RevenueFilter {
  from?: string;
  to?: string;
  course?: string;
  currency?: string;
  status?: string;
  tz?: string;
}
export interface PartnerSummary {
  partner: { id: string; name: string; logoUrl: string | null };
  totals: RevenueTotals;
  /** Per-day totals over all matching entries (chart). */
  daily: RevenuePoint[];
  /** Number of matching entries (the Entries table shows at most 1000). */
  entries: number;
  /** Current share of each sale after instructor shares, basis points. Old entries keep the percent used at payment time. */
  sharePercentBp: number;
  /** Courses this partner's entries come from (for the filter). */
  courses: { id: string; title: string; slug: string }[];
}
export const summary = (f: RevenueFilter = {}) => get<PartnerSummary>('/partner/summary', { ...f });
export const revenue = (f: RevenueFilter = {}) => get<RevenueRow[]>('/partner/revenue', { ...f });
export const csv = (f: RevenueFilter = {}) => download(`/partner/revenue.csv${qs({ ...f })}`, 'revenue-sharing.csv');
export const payouts = () => get<Payout[]>('/partner/payouts');
