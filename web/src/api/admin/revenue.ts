// API: revenue report, balances, payouts.
import { download, get, post, qs } from '../client';
import type { Payout, RevenuePoint, RevenueRow, RevenueTotals } from '@/types';

export interface RevenueQuery {
  from?: string;
  to?: string;
  course?: string;
  partner?: string;
  currency?: string;
  status?: string;
  tz?: string;
}
export const report = (q: RevenueQuery) => get<{ summary: RevenueTotals; rows: RevenueRow[]; total: number; daily: RevenuePoint[] }>('/admin/revenue', { ...q });
export const csv = (q: RevenueQuery) => download(`/admin/revenue.csv${qs({ ...q })}`, 'revenue.csv');
export const balances = () => get<{ partnerId: string; partnerName: string; currency: string; outstandingMinor: number; entries: number }[]>('/admin/revenue/balances');
export const markPaid = (p: { partnerId: string; currency: string; reference?: string; note?: string; periodTo?: string }) => post<Payout>('/admin/revenue/payouts', p);
export const payouts = (partner?: string) => get<Payout[]>('/admin/revenue/payouts', { partner });
