// Bank transfer with slip upload (requireAuth). Spec 15.6.
//   GET  /payments/bank-details                 (LandingSection "bank"; [placeholders] until the owner provides them)
//   POST /courses/:id/checkout/bank-transfer    -> Order AWAITING_SLIP (THB), reused if one is open
//   POST /orders/:id/slip  { file }             (one image <= 5 MB, private storage)
//   GET  /orders/:id/slips                      (own slips + short-lived links)
//   POST /orders/:id/cancel                     (own bank transfer with no slip under review -> FAILED; pick another method)
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body } from '../../lib/validate.js';
import { decodeImage, fileInput, privateKey } from '../../lib/attachments.js';
import { optimizeImage } from '../../lib/images.js';
import { requireAuth, requireLearner } from '../../middleware/auth.js';
import { storage } from '../../providers/storage/index.js';
import { loadPurchasable, orderView } from './orders.service.js';
import { resolveMethod } from './checkout-methods.js';

export const bankTransferRouter = Router();
const auth = [requireAuth, requireLearner];

export const BANK_PLACEHOLDER = {
  bankName: '[Bank name]',
  accountName: '[Account name]',
  accountNumber: '[Account number]',
  note: '[Transfer note shown to the learner]',
  placeholder: true,
};

export async function bankDetails() {
  const row = await prisma.landingSection.findUnique({ where: { key: 'bank' } });
  return row ? { ...BANK_PLACEHOLDER, ...(row.content as object), placeholder: false } : BANK_PLACEHOLDER;
}

const SLIP_URL_TTL = 300;

bankTransferRouter.get('/payments/bank-details', ...auth, h(async (_req, res) => res.json(await bankDetails())));

bankTransferRouter.post(
  '/courses/:id/checkout/bank-transfer',
  ...auth,
  h(async (req, res) => {
    const user = req.user!;
    const course = await loadPurchasable(req.params.id, user.id);
    const option = resolveMethod(course, 'bank', 'thb');
    const open = await prisma.order.findFirst({
      where: { userId: user.id, courseId: course.id, provider: 'BANK_TRANSFER', status: 'AWAITING_SLIP' },
      orderBy: { createdAt: 'desc' },
    });
    const order =
      open ??
      (await prisma.order.create({
        data: {
          userId: user.id,
          courseId: course.id,
          amountMinor: option.amountMinor,
          currency: 'thb',
          provider: 'BANK_TRANSFER',
          method: 'bank',
          status: 'AWAITING_SLIP',
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        },
      }));
    res.status(open ? 200 : 201).json({ order: orderView(order), bank: await bankDetails() });
  }),
);

bankTransferRouter.post(
  '/orders/:id/slip',
  ...auth,
  h(async (req, res) => {
    const { file } = body(req, z.object({ file: fileInput }));
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { slips: true } });
    if (!order || order.userId !== req.user!.id) throw new AppError('NOT_FOUND', 404);
    if (order.status !== 'AWAITING_SLIP') throw new AppError('VALIDATION_FAILED', 409, 'This order does not need a slip');
    if (order.slips.some((s) => s.status === 'PENDING')) {
      throw new AppError('VALIDATION_FAILED', 409, 'A slip is already waiting for review');
    }
    const img = await optimizeImage(decodeImage(file), 'slip');
    const key = privateKey(`slips/${order.id}`, img.ext);
    await storage.putPrivate(key, img.buffer, img.mime);
    const slip = await prisma.paymentSlip.create({ data: { orderId: order.id, storageKey: key, mime: img.mime, sizeBytes: img.buffer.length } });
    res.status(201).json({ id: slip.id, status: slip.status, createdAt: slip.createdAt });
  }),
);

bankTransferRouter.post(
  '/orders/:id/cancel',
  ...auth,
  h(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order || order.userId !== req.user!.id) throw new AppError('NOT_FOUND', 404);
    // Only while nothing is being checked: once a slip waits for review the admin decides.
    const done = await prisma.order.updateMany({
      where: { id: order.id, provider: 'BANK_TRANSFER', status: 'AWAITING_SLIP', slips: { none: { status: 'PENDING' } } },
      data: { status: 'FAILED' },
    });
    if (!done.count) throw new AppError('VALIDATION_FAILED', 409, 'This order can no longer be cancelled');
    res.json({ ok: true });
  }),
);

bankTransferRouter.get(
  '/orders/:id/slips',
  ...auth,
  h(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { slips: { orderBy: { createdAt: 'desc' } } } });
    if (!order || order.userId !== req.user!.id) throw new AppError('NOT_FOUND', 404);
    res.json(
      await Promise.all(
        order.slips.map(async (s) => ({
          id: s.id,
          status: s.status,
          reason: s.reason,
          createdAt: s.createdAt,
          reviewedAt: s.reviewedAt,
          url: await storage.signedUrl(s.storageKey, SLIP_URL_TTL),
        })),
      ),
    );
  }),
);
