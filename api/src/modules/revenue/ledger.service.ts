// Revenue-share ledger (spec 15.1). Rows are never updated (except payout linking) or deleted.
// - onOrderPaid: one RevenueEntry per CourseRevenueShare; percentBp is SNAPSHOT at that moment.
// - onOrderRefunded: negative mirror entries using the SAME stored percent; reversesId is unique, so it runs once.
// Co-investors (PARTNER) and instructors with a share use the same ledger.
import type { Order } from '@prisma/client';
import type { Tx } from '../../db.js';
import { shareOf } from '../../lib/money.js';

export async function onOrderPaid(tx: Tx, order: Order) {
  const already = await tx.revenueEntry.count({ where: { orderId: order.id, reversesId: null } });
  if (already > 0) return [];
  const shares = await tx.courseRevenueShare.findMany({ where: { courseId: order.courseId } });
  const rows = shares
    .filter((s) => s.percentBp > 0)
    .map((s) => ({
      partnerId: s.partnerId,
      orderId: order.id,
      courseId: order.courseId,
      currency: order.currency,
      baseMinor: order.amountMinor,
      percentBp: s.percentBp,
      amountMinor: shareOf(order.amountMinor, s.percentBp),
    }));
  if (rows.length) await tx.revenueEntry.createMany({ data: rows });
  return rows;
}

export async function onOrderRefunded(tx: Tx, orderId: string) {
  const originals = await tx.revenueEntry.findMany({ where: { orderId, reversesId: null, amountMinor: { gt: 0 } } });
  const created = [];
  for (const e of originals) {
    const exists = await tx.revenueEntry.findUnique({ where: { reversesId: e.id } });
    if (exists) continue;
    created.push(
      await tx.revenueEntry.create({
        data: {
          partnerId: e.partnerId,
          orderId: e.orderId,
          courseId: e.courseId,
          currency: e.currency,
          baseMinor: -e.baseMinor,
          percentBp: e.percentBp,
          amountMinor: -e.amountMinor,
          reversesId: e.id,
        },
      }),
    );
  }
  return created;
}
