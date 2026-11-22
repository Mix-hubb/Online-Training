// API: partner portal (own data only).
import { download, get, qs } from './client';
import type { Payout, RevenueRow, RevenueTotals } from '@/types';

export interface RevenueFilter {
  from?: string;
  to?: string;
  course?: string;
  currency?: string;
  status?: string;
}
export interface PartnerSummary {
  partner: { id: string; name: string; logoUrl: string | null };
  totals: RevenueTotals;
  /** Current share of total revenue (all courses), basis points. Old entries keep the percent used at payment time. */
  sharePercentBp: number;
  /** Courses this partner's entries come from (for the filter). */
  courses: { id: string; title: string; slug: string }[];
}
export const summary = (f: RevenueFilter = {}) => get<PartnerSummary>('/partner/summary', { ...f });
export const revenue = (f: RevenueFilter = {}) => get<RevenueRow[]>('/partner/revenue', { ...f });
export const csv = (f: RevenueFilter = {}) => download(`/partner/revenue.csv${qs({ ...f })}`, 'revenue-sharing.csv');
export const payouts = () => get<Payout[]>('/partner/payouts');
