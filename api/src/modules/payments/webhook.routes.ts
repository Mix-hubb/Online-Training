// Stripe webhook (raw body, mounted before express.json()).
//   POST /stripe/webhook
// checkout.session.completed (paid)          -> markOrderPaid (idempotent)
// checkout.session.async_payment_succeeded   -> markOrderPaid (PromptPay)
// checkout.session.async_payment_failed / expired -> order FAILED (only from PENDING)
// charge.refunded                             -> REFUNDED + negative ledger entries (access kept, open decision 10.3)
import { Router } from 'express';
import type Stripe from 'stripe';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { markOrderPaid, markOrderRefunded } from '../../lib/order-paid.js';
import { stripe } from './stripe.js';

export const stripeWebhookRouter = Router();

async function receiptFor(paymentIntentId: string | null): Promise<string | null> {
  if (!stripe || !paymentIntentId) return null;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
    const charge = pi.latest_charge as Stripe.Charge | null;
    return charge?.receipt_url ?? null;
  } catch {
    return null;
  }
}

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.payment_status !== 'paid') return; // PromptPay: wait for async_payment_succeeded
      const order = await prisma.order.findUnique({ where: { stripeSessionId: s.id } });
      if (!order) return;
      const pi = typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null);
      await markOrderPaid(order.id, { stripePaymentIntentId: pi, receiptUrl: await receiptFor(pi) });
      return;
    }
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      const s = event.data.object as Stripe.Checkout.Session;
      await prisma.order.updateMany({ where: { stripeSessionId: s.id, status: 'PENDING' }, data: { status: 'FAILED' } });
      return;
    }
    case 'charge.refunded': {
      const c = event.data.object as Stripe.Charge;
      const pi = typeof c.payment_intent === 'string' ? c.payment_intent : c.payment_intent?.id;
      if (!pi || !c.refunded) return; // partial refunds: handled by hand for now
      const order = await prisma.order.findFirst({ where: { stripePaymentIntentId: pi } });
      if (order) await markOrderRefunded(order.id);
      return;
    }
    default:
      return;
  }
}

stripeWebhookRouter.post('/', async (req, res) => {
  if (!stripe || !config.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: { code: 'INTERNAL', message: 'Stripe not set up' } });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, req.headers['stripe-signature'] as string, config.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'Bad signature' } });
  }
  try {
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (e) {
    console.error('stripe webhook failed', event.type, e);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Webhook handling failed' } });
  }
});
