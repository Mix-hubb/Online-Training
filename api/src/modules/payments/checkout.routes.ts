// Checkout + orders (requireAuth).
//   POST /courses/:id/checkout  { method: card|promptpay|btc, currency: usd|thb } -> { url }
//   GET  /orders                   (my orders + receiptUrl)
//   GET  /orders/by-session/:sessionId  (polled after the Stripe redirect until PAID)
//   GET  /orders/:id
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body } from '../../lib/validate.js';
import { requireAuth, requireLearner } from '../../middleware/auth.js';
import { orderView, startCheckout } from './orders.service.js';

export const checkoutRouter = Router();
const auth = [requireAuth, requireLearner];

checkoutRouter.post(
  '/courses/:id/checkout',
  ...auth,
  h(async (req, res) => {
    const input = body(req, z.object({ method: z.enum(['card', 'promptpay', 'btc']).default('card'), currency: z.enum(['usd', 'thb']).default('usd') }));
    res.status(201).json(await startCheckout(req.user!, req.params.id, input.method, input.currency));
  }),
);

checkoutRouter.get(
  '/orders',
  ...auth,
  h(async (req, res) => {
    const rows = await prisma.order.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { course: { select: { title: true, slug: true, thumbnailUrl: true } } },
    });
    res.json(rows.map(orderView));
  }),
);

checkoutRouter.get(
  '/orders/by-session/:sessionId',
  ...auth,
  h(async (req, res) => {
    const o = await prisma.order.findUnique({
      where: { stripeSessionId: req.params.sessionId },
      include: { course: { select: { title: true, slug: true, thumbnailUrl: true } } },
    });
    if (!o || o.userId !== req.user!.id) throw new AppError('NOT_FOUND', 404);
    res.json(orderView(o));
  }),
);

checkoutRouter.get(
  '/orders/:id',
  ...auth,
  h(async (req, res) => {
    const o = await prisma.order.findUnique({ where: { id: req.params.id }, include: { course: { select: { title: true, slug: true, thumbnailUrl: true } } } });
    if (!o || o.userId !== req.user!.id) throw new AppError('NOT_FOUND', 404);
    res.json(orderView(o));
  }),
);
