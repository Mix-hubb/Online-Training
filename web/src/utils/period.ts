// Report period: a whole month, or specific days. All dates are the viewer's local calendar days;
// the API gets exact instants (start of the first day .. end of the last day).

export interface Period {
  mode: 'month' | 'days';
  month: string; // YYYY-MM
  from: string; // YYYY-MM-DD (days mode)
  to: string; // YYYY-MM-DD (days mode)
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

function parseDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function thisMonth(): Period {
  const now = new Date();
  return { mode: 'month', month: monthKey(now), from: dayKey(now), to: dayKey(now) };
}

/** Shift a YYYY-MM month by n months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}

/** First and last local day of the period (inclusive), or null when the inputs are incomplete. */
export function periodDays(p: Period): { start: Date; end: Date } | null {
  if (p.mode === 'month') {
    const m = /^(\d{4})-(\d{2})$/.exec(p.month);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    return { start: new Date(y, mo, 1), end: new Date(y, mo + 1, 0) };
  }
  const a = parseDay(p.from);
  const b = parseDay(p.to || p.from);
  if (!a || !b) return null;
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** { from, to } instants for the API (empty when the period is incomplete), plus the viewer's time zone for per-day totals. */
export function periodQuery(p: Period): { from: string; to: string; tz: string } {
  const d = periodDays(p);
  if (!d) return { from: '', to: '', tz: TZ };
  const end = new Date(d.end.getFullYear(), d.end.getMonth(), d.end.getDate(), 23, 59, 59, 999);
  return { from: d.start.toISOString(), to: end.toISOString(), tz: TZ };
}

const fmtMonth = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const fmtDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "November 2026", "5 Nov 2026" or "1 Nov 2026 – 15 Nov 2026". */
export function periodLabel(p: Period): string {
  const d = periodDays(p);
  if (!d) return '';
  if (p.mode === 'month') return fmtMonth.format(d.start);
  return dayKey(d.start) === dayKey(d.end) ? fmtDay.format(d.start) : `${fmtDay.format(d.start)} – ${fmtDay.format(d.end)}`;
}
