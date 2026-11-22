// Revenue report + CSV export. Grouped per currency (never USD + THB together).
// Rows NEVER include buyer identity (no user fields), so the same rows are safe for partners.
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db.js';

export const reportQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  course: z.string().optional(),
  partner: z.string().optional(),
  currency: z.enum(['usd', 'thb']).optional(),
  status: z.enum(['UNPAID', 'PAID']).optional(),
});
export type ReportQuery = z.infer<typeof reportQuery>;

function whereOf(q: ReportQuery): Prisma.RevenueEntryWhereInput {
  return {
    ...(q.partner ? { partnerId: q.partner } : {}),
    ...(q.course ? { courseId: q.course } : {}),
    ...(q.currency ? { currency: q.currency } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
  };
}

export async function revenueRows(q: ReportQuery, limit = 5000) {
  const rows = await prisma.revenueEntry.findMany({
    where: whereOf(q),
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { partner: { select: { id: true, name: true } }, payout: { select: { id: true, paidAt: true, reference: true } } },
  });
  const courseIds = [...new Set(rows.map((r) => r.courseId))];
  const courses = await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } });
  const title = new Map(courses.map((c) => [c.id, c.title]));
  return rows.map((r) => ({
    id: r.id,
    date: r.createdAt,
    partnerId: r.partner.id,
    partnerName: r.partner.name,
    courseId: r.courseId,
    courseTitle: title.get(r.courseId) ?? '(deleted course)',
    orderRef: r.orderId.slice(-8).toUpperCase(),
    currency: r.currency,
    baseMinor: r.baseMinor,
    percentBp: r.percentBp,
    amountMinor: r.amountMinor,
    status: r.status,
    payout: r.payout,
  }));
}

export async function summary(q: ReportQuery) {
  const groups = await prisma.revenueEntry.groupBy({
    by: ['currency', 'status'],
    where: whereOf(q),
    _sum: { amountMinor: true },
  });
  const out: Record<string, { earned: number; paid: number; outstanding: number }> = {};
  for (const g of groups) {
    const s = (out[g.currency] ??= { earned: 0, paid: 0, outstanding: 0 });
    const v = g._sum.amountMinor ?? 0;
    s.earned += v;
    if (g.status === 'PAID') s.paid += v;
    else s.outstanding += v;
  }
  return out;
}

/** Outstanding (UNPAID) per partner per currency. */
export async function balances() {
  const groups = await prisma.revenueEntry.groupBy({
    by: ['partnerId', 'currency'],
    where: { status: 'UNPAID' },
    _sum: { amountMinor: true },
    _count: true,
  });
  const partners = await prisma.partner.findMany({ select: { id: true, name: true } });
  const name = new Map(partners.map((p) => [p.id, p.name]));
  return groups.map((g) => ({
    partnerId: g.partnerId,
    partnerName: name.get(g.partnerId) ?? '',
    currency: g.currency,
    outstandingMinor: g._sum.amountMinor ?? 0,
    entries: g._count,
  }));
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Prevent spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(rows: Awaited<ReturnType<typeof revenueRows>>, opts: { includePartner: boolean }) {
  const head = ['date', ...(opts.includePartner ? ['partner'] : []), 'course', 'order', 'currency', 'order_amount', 'share_percent', 'share_amount', 'status'];
  const lines = rows.map((r) =>
    [
      r.date.toISOString(),
      ...(opts.includePartner ? [r.partnerName] : []),
      r.courseTitle,
      r.orderRef,
      r.currency.toUpperCase(),
      (r.baseMinor / 100).toFixed(2),
      (r.percentBp / 100).toFixed(2),
      (r.amountMinor / 100).toFixed(2),
      r.status,
    ]
      .map(csvCell)
      .join(','),
  );
  return [head.join(','), ...lines].join('\n') + '\n';
}

export async function payoutsOf(partnerId?: string) {
  return prisma.partnerPayout.findMany({
    where: partnerId ? { partnerId } : {},
    orderBy: { paidAt: 'desc' },
    include: { partner: { select: { id: true, name: true } }, _count: { select: { entries: true } } },
  });
}
