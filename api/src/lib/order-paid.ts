// markOrderPaid(): the ONE path to PAID (Stripe card/PromptPay, bank slip, Bitcoin, dev fake). Spec 15.6.
// In one transaction: order -> PAID (only from PENDING / AWAITING_SLIP / FAILED), Enrollment, ledger entries, notification.
// Idempotent: a second call finds the order already PAID and does nothing.
import { prisma, type Tx } from '../db.js';
import { AppError } from './errors.js';
import { notify } from './notify.js';
import { ensureEnrollment } from '../modules/learning/enrollment.service.js';
import { onOrderPaid } from '../modules/revenue/ledger.service.js';

export interface PaidInfo {
  stripePaymentIntentId?: string | null;
  receiptUrl?: string | null;
}

export async function markOrderPaid(orderId: string, info: PaidInfo = {}, outer?: Tx): Promise<{ changed: boolean }> {
  const run = async (tx: Tx) => {
    const flipped = await tx.order.updateMany({
      where: { id: orderId, status: { in: ['PENDING', 'AWAITING_SLIP', 'FAILED'] } },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        ...(info.stripePaymentIntentId ? { stripePaymentIntentId: info.stripePaymentIntentId } : {}),
        ...(info.receiptUrl ? { receiptUrl: info.receiptUrl } : {}),
      },
    });
    if (flipped.count === 0) {
      const exists = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!exists) throw new AppError('NOT_FOUND', 404);
      return { changed: false };
    }
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { course: true } });
    await ensureEnrollment(order.userId, order.courseId, tx);
    await onOrderPaid(tx, order);
    await notify(order.userId, `Payment received. You can now start "${order.course.title}".`, `/learn/${order.course.slug}`, tx);
    return { changed: true };
  };
  return outer ? run(outer) : prisma.$transaction(run);
}
