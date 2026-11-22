// Display helpers. Money is stored in minor units; USD and THB are never added together.
import type { LearningStatus, Level } from '@/types';

export function money(minor: number, currency = 'usd'): string {
  const cur = currency.toUpperCase();
  const digits = cur === 'THB' && minor % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: digits, maximumFractionDigits: 2 }).format(minor / 100);
}

export function percentBp(bp: number): string {
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`;
}

export function duration(sec: number): string {
  if (!sec) return '0 min';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} h ${m} min` : `${Math.max(1, m)} min`;
}

export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function date(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const levelLabel: Record<Level, string> = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' };

export const learningStatusLabel: Record<LearningStatus, string> = {
  IN_PROGRESS: 'In progress',
  READY_FOR_TEST: 'Ready for final test',
  WAITING_FOR_INSTRUCTOR: 'Waiting for instructor',
  LESSONS_RESTARTED: 'Lessons restarted',
  COMPLETED: 'Completed',
};

export const methodLabel: Record<string, string> = { card: 'Card', promptpay: 'PromptPay', bank: 'Bank transfer', btc: 'Bitcoin' };

export function priceLabel(c: { isFree: boolean; priceMinor: number; priceThbMinor: number | null }): string {
  if (c.isFree) return 'Free';
  const parts = [];
  if (c.priceMinor > 0) parts.push(money(c.priceMinor, 'usd'));
  if (c.priceThbMinor) parts.push(money(c.priceThbMinor, 'thb'));
  return parts.join(' / ');
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
