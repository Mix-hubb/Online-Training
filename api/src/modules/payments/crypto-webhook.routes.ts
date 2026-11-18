// Bitcoin provider webhook (raw body, before express.json()). Idempotent through markOrderPaid.
//   POST /crypto/webhook
import { Router } from 'express';
import { prisma } from '../../db.js';
import { markOrderPaid } from '../../lib/order-paid.js';
import { cryptoProvider } from '../../providers/payments/index.js';

export const cryptoWebhookRouter = Router();

cryptoWebhookRouter.post('/', async (req, res) => {
  if (!cryptoProvider.enabled) return res.status(503).json({ error: { code: 'PAYMENT_METHOD_UNAVAILABLE', message: 'Bitcoin not set up' } });
  try {
    const ev = await cryptoProvider.verifyWebhook(req.body as Buffer, req.headers);
    const order = await prisma.order.findUnique({ where: { providerRef: ev.providerChargeId } });
    if (order) {
      if (ev.status === 'PAID') await markOrderPaid(order.id);
      else if (ev.status === 'EXPIRED') await prisma.order.updateMany({ where: { id: order.id, status: 'PENDING' }, data: { status: 'FAILED' } });
    }
    res.json({ received: true });
  } catch {
    res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'Bad webhook' } });
  }
});
