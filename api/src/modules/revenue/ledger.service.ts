// Revenue-share ledger (spec 15.1, changed 2026-11-22, see 16.2). Rows are never updated (except payout linking) or deleted.
// On each paid order, in this order:
//   1. INSTRUCTOR entries: every instructor assigned to the order's course with a share > 0 gets
//      CourseInstructor.sharePercentBp of the order amount.
//   2. PARTNER entries: every co-investor with a share > 0 gets Partner.sharePercentBp of what is LEFT after step 1.
// percentBp and baseMinor are SNAPSHOT on the entry, so changing a percent later never changes existing entries.
// There are no refunds in the system (handled with the payment gateway, outside it), so no reversal entries.
// Instructors and co-investors are both Partner rows (an instructor's Partner is created on demand, linked by userId).
import type { Order, User } from '@prisma/client';
import type { Tx } from '../../db.js';
import { shareOf } from '../../lib/money.js';

export const MAX_TOTAL_SHARE_BP = 10000;

/** The Partner row that receives an instructor's earnings; created the first time it is needed. */
export async function ensureInstructorPartner(tx: Tx, user: Pick<User, 'id' | 'name'>) {
  const found = await tx.partner.findUnique({ where: { userId: user.id } });
  if (found) return found;
  return tx.partner.create({ data: { name: user.name, userId: user.id } });
}

export async function onOrderPaid(tx: Tx, order: Order) {
  const already = await tx.revenueEntry.count({ where: { orderId: order.id } });
  if (already > 0) return [];
  const base = {
    orderId: order.id,
    courseId: order.courseId,
    currency: order.currency,
  };

  // 1. Instructors of this course.
  const teachers = await tx.courseInstructor.findMany({
    where: { courseId: order.courseId, sharePercentBp: { gt: 0 } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { assignedAt: 'asc' },
  });
  const rows = [];
  for (const t of teachers) {
    const partner = await ensureInstructorPartner(tx, t.user);
    rows.push({
      ...base,
      partnerId: partner.id,
      kind: 'INSTRUCTOR' as const,
      baseMinor: order.amountMinor,
      percentBp: t.sharePercentBp,
      amountMinor: shareOf(order.amountMinor, t.sharePercentBp),
    });
  }

  // 2. Co-investors, on what is left. Partners linked to an INSTRUCTOR account never take a share here.
  const left = Math.max(0, order.amountMinor - rows.reduce((s, r) => s + r.amountMinor, 0));
  const partners = await tx.partner.findMany({
    where: { sharePercentBp: { gt: 0 }, OR: [{ userId: null }, { user: { role: { not: 'INSTRUCTOR' } } }] },
    select: { id: true, sharePercentBp: true },
  });
  for (const p of partners) {
    rows.push({
      ...base,
      partnerId: p.id,
      kind: 'PARTNER' as const,
      baseMinor: left,
      percentBp: p.sharePercentBp,
      amountMinor: shareOf(left, p.sharePercentBp),
    });
  }

  if (rows.length) await tx.revenueEntry.createMany({ data: rows });
  return rows;
}
