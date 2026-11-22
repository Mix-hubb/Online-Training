// Revenue-share ledger (spec 15.1, changed 2026-11-22). Rows are never updated (except payout linking) or deleted.
// - Each Partner has ONE share of total revenue (Partner.sharePercentBp), not per course.
// - onOrderPaid: one RevenueEntry per partner with a share; percentBp is SNAPSHOT at that moment,
//   so changing a partner's percent later never changes existing entries.
// - There are no refunds in the system (handled with the payment gateway, outside it), so no reversal entries.
// Co-investors (PARTNER) and instructors with a share use the same ledger.
// TODO(open question 2026-11-22): whether instructors still get a revenue share. Not decided; instructor partners still count.
import type { Order } from '@prisma/client';
import type { Tx } from '../../db.js';
import { shareOf } from '../../lib/money.js';

export const MAX_TOTAL_SHARE_BP = 10000;

export async function onOrderPaid(tx: Tx, order: Order) {
  const already = await tx.revenueEntry.count({ where: { orderId: order.id } });
  if (already > 0) return [];
  const partners = await tx.partner.findMany({ where: { sharePercentBp: { gt: 0 } }, select: { id: true, sharePercentBp: true } });
  const rows = partners.map((p) => ({
    partnerId: p.id,
    orderId: order.id,
    courseId: order.courseId,
    currency: order.currency,
    baseMinor: order.amountMinor,
    percentBp: p.sharePercentBp,
    amountMinor: shareOf(order.amountMinor, p.sharePercentBp),
  }));
  if (rows.length) await tx.revenueEntry.createMany({ data: rows });
  return rows;
}
