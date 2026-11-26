import { beforeEach, describe, expect, it } from 'vitest';
import { availableMethods } from '../src/modules/payments/checkout-methods.js';
import { markOrderPaid } from '../src/lib/order-paid.js';
import { as, makeCourse, makeUser, pngBase64, prisma, resetDb } from './helpers.js';

describe('payment methods', () => {
  beforeEach(resetDb);

  it('PromptPay only with THB', async () => {
    expect(availableMethods({ isFree: false, priceMinor: 1000, priceThbMinor: null }).map((m) => m.method)).toEqual(['card']);
    const both = availableMethods({ isFree: false, priceMinor: 1000, priceThbMinor: 35000 });
    expect(both.filter((m) => m.method === 'promptpay').every((m) => m.currency === 'thb')).toBe(true);

    const u = await makeUser();
    const c = await makeCourse({ isFree: false, priceMinor: 1000, priceThbMinor: 35000 });
    const bad = await as(u.id).post(`/courses/${c.id}/checkout`).send({ method: 'promptpay', currency: 'usd' });
    expect(bad.body.error.code).toBe('PAYMENT_METHOD_UNAVAILABLE');
    const noThb = await makeCourse({ isFree: false, priceMinor: 1000 });
    const bad2 = await as(u.id).post(`/courses/${noThb.id}/checkout`).send({ method: 'promptpay', currency: 'thb' });
    expect(bad2.body.error.code).toBe('PAYMENT_METHOD_UNAVAILABLE');
  });

  it('prices below the Stripe minimum: refused in admin, no order at checkout', async () => {
    const admin = await makeUser('ADMIN');
    const c = await makeCourse({ isFree: false, priceMinor: 1000, priceThbMinor: 35000 });
    const tooLow = await as(admin.id).patch(`/admin/courses/${c.id}`).send({ priceThbMinor: 100 });
    expect(tooLow.status).toBe(400);
    expect(tooLow.body.error.message).toContain('฿10');
    expect((await as(admin.id).patch(`/admin/courses/${c.id}`).send({ priceMinor: 49 })).status).toBe(400);
    expect((await as(admin.id).patch(`/admin/courses/${c.id}`).send({ priceThbMinor: 1000, priceMinor: 50 })).status).toBe(200);

    // A course saved with a low price before this rule: checkout says why and leaves no PENDING order.
    const old = await makeCourse({ isFree: false, priceMinor: 100, priceThbMinor: 100 });
    const u = await makeUser();
    const r = await as(u.id).post(`/courses/${old.id}/checkout`).send({ method: 'promptpay', currency: 'thb' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('PAYMENT_METHOD_UNAVAILABLE');
    expect(await prisma.order.count({ where: { courseId: old.id } })).toBe(0);
  });

  it('orders list: only paid orders or transfers with a slip; unpaid transfer can be cancelled', async () => {
    const u = await makeUser();
    const other = await makeUser();
    const c = await makeCourse({ isFree: false, priceMinor: 1000, priceThbMinor: 35000 });
    await prisma.order.create({ data: { userId: u.id, courseId: c.id, amountMinor: 1000, currency: 'usd', provider: 'STRIPE', method: 'card' } });

    const co = await as(u.id).post(`/courses/${c.id}/checkout/bank-transfer`);
    const orderId = co.body.order.id;
    expect((await as(u.id).get('/orders')).body).toHaveLength(0);
    const detail = await as(u.id).get(`/courses/${c.slug}`);
    expect(detail.body.viewer.pendingOrder).toMatchObject({ id: orderId, underReview: false });

    // Not someone else's; then cancel frees the course page for another method.
    expect((await as(other.id).post(`/orders/${orderId}/cancel`)).status).toBe(404);
    expect((await as(u.id).post(`/orders/${orderId}/cancel`)).status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('FAILED');
    // Only the unfinished Stripe checkout is left, which does not lock the purchase card.
    expect((await as(u.id).get(`/courses/${c.slug}`)).body.viewer.pendingOrder.status).toBe('PENDING');
    expect((await as(u.id).post(`/orders/${orderId}/cancel`)).status).toBe(409);

    // With a slip under review: listed, and no longer cancellable.
    const again = (await as(u.id).post(`/courses/${c.id}/checkout/bank-transfer`)).body.order.id;
    expect(again).not.toBe(orderId);
    await as(u.id).post(`/orders/${again}/slip`).send({ file: { dataBase64: pngBase64(500) } });
    expect((await as(u.id).get('/orders')).body.map((o: { id: string }) => o.id)).toEqual([again]);
    expect((await as(u.id).get(`/courses/${c.slug}`)).body.viewer.pendingOrder.underReview).toBe(true);
    expect((await as(u.id).post(`/orders/${again}/cancel`)).status).toBe(409);
  });

  it('dev checkout pays with the THB price', async () => {
    const u = await makeUser();
    const c = await makeCourse({ isFree: false, priceMinor: 1000, priceThbMinor: 35000 });
    const r = await as(u.id).post(`/courses/${c.id}/checkout`).send({ method: 'card', currency: 'thb' });
    expect(r.status).toBe(201);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: r.body.orderId } });
    expect(o.amountMinor).toBe(35000);
    expect(o.status).toBe('PAID');
    const again = await as(u.id).post(`/courses/${c.id}/checkout`).send({ method: 'card', currency: 'usd' });
    expect(again.body.error.code).toBe('ALREADY_ENROLLED');
  });

  it('free course: enroll; paid course: NOT_FREE', async () => {
    const u = await makeUser();
    const free = await makeCourse();
    const paid = await makeCourse({ isFree: false, priceMinor: 1000 });
    expect((await as(u.id).post(`/courses/${free.id}/enroll`)).status).toBe(201);
    expect((await as(u.id).post(`/courses/${paid.id}/enroll`)).body.error.code).toBe('NOT_FREE');
  });

  it('slip approve/reject runs once', async () => {
    const u = await makeUser();
    const admin = await makeUser('ADMIN');
    const c = await makeCourse({ isFree: false, priceMinor: 1000, priceThbMinor: 35000 });
    await prisma.partner.create({ data: { name: 'P', sharePercentBp: 1000 } });

    const co = await as(u.id).post(`/courses/${c.id}/checkout/bank-transfer`);
    expect(co.status).toBe(201);
    const orderId = co.body.order.id;
    expect(co.body.order.status).toBe('AWAITING_SLIP');
    expect(co.body.bank.placeholder).toBe(true);

    expect((await as(u.id).post(`/orders/${orderId}/slip`).send({ file: { dataBase64: pngBase64(500) } })).status).toBe(201);
    const rej = await as(admin.id).post(`/admin/payments/${orderId}/reject`).send({ reason: 'Amount does not match' });
    expect(rej.status).toBe(200);
    expect((await as(admin.id).post(`/admin/payments/${orderId}/reject`).send({ reason: 'again' })).body.error.code).toBe('SLIP_ALREADY_REVIEWED');

    expect((await as(u.id).post(`/orders/${orderId}/slip`).send({ file: { dataBase64: pngBase64(500) } })).status).toBe(201);
    const results = await Promise.all([as(admin.id).post(`/admin/payments/${orderId}/approve`), as(admin.id).post(`/admin/payments/${orderId}/approve`)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PAID');
    expect(await prisma.enrollment.count({ where: { userId: u.id, courseId: c.id } })).toBe(1);
    expect(await prisma.revenueEntry.count({ where: { orderId } })).toBe(1);
  });

  it('markOrderPaid idempotent across Stripe, slip, Bitcoin', async () => {
    const u = await makeUser();
    const c = await makeCourse({ isFree: false, priceMinor: 1000, priceThbMinor: 35000 });
    await prisma.partner.create({ data: { name: 'P', sharePercentBp: 1000 } });
    const o = await prisma.order.create({ data: { userId: u.id, courseId: c.id, amountMinor: 1000, currency: 'usd', provider: 'CRYPTO', providerRef: 'btc_1' } });
    // Three different sources race for the same order.
    await Promise.all([markOrderPaid(o.id), markOrderPaid(o.id, { stripePaymentIntentId: 'pi_x' }), markOrderPaid(o.id)]);
    expect(await prisma.enrollment.count({ where: { userId: u.id } })).toBe(1);
    expect(await prisma.revenueEntry.count({ where: { orderId: o.id } })).toBe(1);
  });

  it('Bitcoin is unavailable until a provider is chosen', async () => {
    const u = await makeUser();
    const c = await makeCourse({ isFree: false, priceMinor: 1000 });
    const r = await as(u.id).post(`/courses/${c.id}/checkout`).send({ method: 'btc', currency: 'usd' });
    expect(r.body.error.code).toBe('PAYMENT_METHOD_UNAVAILABLE');
  });
});
