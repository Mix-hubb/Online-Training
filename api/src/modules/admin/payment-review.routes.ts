// Bank-transfer slip review. Spec 15.6. Approve and reject each run once (SLIP_ALREADY_REVIEWED).
//   GET  /admin/payments/review?status=PENDING|APPROVED|REJECTED
//   POST /admin/payments/:orderId/approve           -> markOrderPaid (enrollment + ledger)
//   POST /admin/payments/:orderId/reject  { reason } -> learner notified, can upload a new slip
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body, query } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { notify } from '../../lib/notify.js';
import { markOrderPaid } from '../../lib/order-paid.js';
import { storage } from '../../providers/storage/index.js';

export const paymentReviewAdminRouter = Router();

paymentReviewAdminRouter.get(
  '/payments/review',
  h(async (req, res) => {
    const { status } = query(req, z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') }));
    const slips = await prisma.paymentSlip.findMany({
      where: { status },
      orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
      take: 200,
      include: {
        order: {
          include: { user: { select: { id: true, name: true, email: true } }, course: { select: { id: true, title: true } } },
        },
      },
    });
    res.json(
      await Promise.all(
        slips.map(async (s) => ({
          slipId: s.id,
          status: s.status,
          reason: s.reason,
          createdAt: s.createdAt,
          reviewedAt: s.reviewedAt,
          url: await storage.signedUrl(s.storageKey, 300),
          order: {
            id: s.order.id,
            status: s.order.status,
            amountMinor: s.order.amountMinor,
            currency: s.order.currency,
            createdAt: s.order.createdAt,
            user: s.order.user,
            course: s.order.course,
          },
        })),
      ),
    );
  }),
);

paymentReviewAdminRouter.post(
  '/payments/:orderId/approve',
  h(async (req, res) => {
    const orderId = req.params.orderId;
    await prisma.$transaction(async (tx) => {
      const slip = await tx.paymentSlip.findFirst({ where: { orderId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
      if (!slip) throw new AppError('SLIP_ALREADY_REVIEWED', 409);
      const flipped = await tx.paymentSlip.updateMany({
        where: { id: slip.id, status: 'PENDING' },
        data: { status: 'APPROVED', reviewedBy: req.user!.id, reviewedAt: new Date() },
      });
      if (flipped.count === 0) throw new AppError('SLIP_ALREADY_REVIEWED', 409);
      await markOrderPaid(orderId, {}, tx);
      await writeAudit(req.user!.id, 'payment_slip.approve', 'Order', orderId, { slipId: slip.id }, tx);
    });
    res.json({ ok: true });
  }),
);

paymentReviewAdminRouter.post(
  '/payments/:orderId/reject',
  h(async (req, res) => {
    const { reason } = body(req, z.object({ reason: z.string().trim().min(1).max(500) }));
    const orderId = req.params.orderId;
    const order = await prisma.$transaction(async (tx) => {
      const slip = await tx.paymentSlip.findFirst({ where: { orderId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
      if (!slip) throw new AppError('SLIP_ALREADY_REVIEWED', 409);
      const flipped = await tx.paymentSlip.updateMany({
        where: { id: slip.id, status: 'PENDING' },
        data: { status: 'REJECTED', reason, reviewedBy: req.user!.id, reviewedAt: new Date() },
      });
      if (flipped.count === 0) throw new AppError('SLIP_ALREADY_REVIEWED', 409);
      const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { course: true } });
      await notify(o.userId, `Your payment slip for "${o.course.title}" was not accepted: ${reason}`, `/checkout/bank-transfer/${o.id}`, tx);
      await writeAudit(req.user!.id, 'payment_slip.reject', 'Order', orderId, { slipId: slip.id, reason }, tx);
      return o;
    });
    res.json({ ok: true, orderId: order.id });
  }),
);
