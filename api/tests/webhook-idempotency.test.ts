import { beforeEach, describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { handleStripeEvent } from '../src/modules/payments/webhook.routes.js';
import { markOrderPaid } from '../src/lib/order-paid.js';
import { makeCourse, makeUser, prisma, resetDb } from './helpers.js';

function completedEvent(sessionId: string): Stripe.Event {
  return {
    id: `evt_${sessionId}`,
    type: 'checkout.session.completed',
    data: { object: { id: sessionId, payment_status: 'paid', payment_intent: 'pi_test' } },
  } as unknown as Stripe.Event;
}

describe('Stripe webhook idempotency', () => {
  beforeEach(resetDb);

  it('same session twice -> one PAID order, one enrollment', async () => {
    const u = await makeUser();
    const c = await makeCourse({ isFree: false, priceMinor: 1000 });
    const order = await prisma.order.create({
      data: { userId: u.id, courseId: c.id, amountMinor: 1000, currency: 'usd', stripeSessionId: 'cs_test_1', method: 'card' },
    });
    await handleStripeEvent(completedEvent('cs_test_1'));
    await handleStripeEvent(completedEvent('cs_test_1'));
    await Promise.all([handleStripeEvent(completedEvent('cs_test_1')), handleStripeEvent(completedEvent('cs_test_1'))]);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe('PAID');
    expect(o.stripePaymentIntentId).toBe('pi_test');
    expect(await prisma.enrollment.count({ where: { userId: u.id, courseId: c.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: u.id } })).toBe(1);
  });

  it('PromptPay: completed but unpaid waits for async_payment_succeeded', async () => {
    const u = await makeUser();
    const c = await makeCourse({ isFree: false, priceThbMinor: 30000 });
    const order = await prisma.order.create({
      data: { userId: u.id, courseId: c.id, amountMinor: 30000, currency: 'thb', stripeSessionId: 'cs_pp', method: 'promptpay' },
    });
    await handleStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_pp', payment_status: 'unpaid' } } } as unknown as Stripe.Event);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
    await handleStripeEvent({
      type: 'checkout.session.async_payment_succeeded',
      data: { object: { id: 'cs_pp', payment_status: 'paid', payment_intent: 'pi_pp' } },
    } as unknown as Stripe.Event);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
  });

  it('markOrderPaid is a no-op the second time', async () => {
    const u = await makeUser();
    const c = await makeCourse({ isFree: false, priceMinor: 1000 });
    const order = await prisma.order.create({ data: { userId: u.id, courseId: c.id, amountMinor: 1000, currency: 'usd' } });
    expect((await markOrderPaid(order.id)).changed).toBe(true);
    expect((await markOrderPaid(order.id)).changed).toBe(false);
  });
});
