import { beforeEach, describe, expect, it } from 'vitest';
import { markOrderPaid } from '../src/lib/order-paid.js';
import { handleStripeEvent } from '../src/modules/payments/webhook.routes.js';
import { shareOf } from '../src/lib/money.js';
import { as, makeCourse, makeUser, prisma, resetDb } from './helpers.js';

// Revenue share is per partner (share of TOTAL revenue, all courses), changed 2026-11-22.
async function setup() {
  const buyer = await makeUser();
  const admin = await makeUser('ADMIN');
  const c = await makeCourse({ isFree: false, priceMinor: 10000, priceThbMinor: 350000 });
  const p = await prisma.partner.create({ data: { name: 'Co-investor', sharePercentBp: 2500 } });
  return { buyer, admin, c, p };
}

async function paidOrder(userId: string, courseId: string, amountMinor: number, currency: string) {
  const o = await prisma.order.create({ data: { userId, courseId, amountMinor, currency } });
  await markOrderPaid(o.id);
  return o;
}

describe('revenue ledger', () => {
  beforeEach(resetDb);

  it('rounds down', () => {
    expect(shareOf(999, 3333)).toBe(332);
  });

  it('one entry per partner with a share, for every course', async () => {
    const { buyer, c } = await setup();
    await prisma.partner.create({ data: { name: 'Second', sharePercentBp: 1000 } });
    await prisma.partner.create({ data: { name: 'No share' } });
    const other = await makeCourse({ isFree: false, priceMinor: 2000 });
    const o1 = await paidOrder(buyer.id, c.id, 10000, 'usd');
    const o2 = await paidOrder(buyer.id, other.id, 2000, 'usd');
    const e1 = await prisma.revenueEntry.findMany({ where: { orderId: o1.id }, orderBy: { amountMinor: 'desc' } });
    expect(e1.map((e) => e.amountMinor)).toEqual([2500, 1000]);
    const e2 = await prisma.revenueEntry.findMany({ where: { orderId: o2.id }, orderBy: { amountMinor: 'desc' } });
    expect(e2.map((e) => [e.amountMinor, e.courseId])).toEqual([[500, other.id], [200, other.id]]);
  });

  it('stores percent at payment time', async () => {
    const { buyer, admin, c, p } = await setup();
    const o1 = await paidOrder(buyer.id, c.id, 10000, 'usd');
    expect((await as(admin.id).patch(`/admin/partners/${p.id}`).send({ sharePercentBp: 5000 })).status).toBe(200);
    const other = await makeUser();
    await paidOrder(other.id, c.id, 10000, 'usd');
    const e1 = await prisma.revenueEntry.findFirstOrThrow({ where: { orderId: o1.id } });
    expect(e1.percentBp).toBe(2500);
    expect(e1.amountMinor).toBe(2500);
    const all = await prisma.revenueEntry.findMany({ orderBy: { createdAt: 'asc' } });
    expect(all.map((e) => e.percentBp)).toEqual([2500, 5000]);
  });

  it('Stripe refund events are ignored', async () => {
    const { buyer, c } = await setup();
    const o = await paidOrder(buyer.id, c.id, 10000, 'usd');
    await prisma.order.update({ where: { id: o.id }, data: { stripePaymentIntentId: 'pi_r' } });
    await handleStripeEvent({ type: 'charge.refunded', data: { object: { payment_intent: 'pi_r', refunded: true } } } as never);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('PAID');
    const rows = await prisma.revenueEntry.findMany({ where: { orderId: o.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].amountMinor).toBe(2500);
  });

  it('payout covers only unpaid entries', async () => {
    const { buyer, admin, c, p } = await setup();
    await paidOrder(buyer.id, c.id, 10000, 'usd');
    const first = await as(admin.id).post('/admin/revenue/payouts').send({ partnerId: p.id, currency: 'usd', reference: 'TX-1' });
    expect(first.status).toBe(201);
    expect(first.body.totalMinor).toBe(2500);
    const b2 = await makeUser();
    await paidOrder(b2.id, c.id, 10000, 'usd');
    const second = await as(admin.id).post('/admin/revenue/payouts').send({ partnerId: p.id, currency: 'usd' });
    expect(second.body.totalMinor).toBe(2500);
    const empty = await as(admin.id).post('/admin/revenue/payouts').send({ partnerId: p.id, currency: 'usd' });
    expect(empty.status).toBe(400);
    expect(await prisma.auditLog.count({ where: { action: 'payout.create' } })).toBe(2);
  });

  it('USD and THB never summed', async () => {
    const { buyer, admin, c } = await setup();
    await paidOrder(buyer.id, c.id, 10000, 'usd');
    const b2 = await makeUser();
    await paidOrder(b2.id, c.id, 350000, 'thb');
    const r = await as(admin.id).get('/admin/revenue');
    expect(r.body.summary.usd.earned).toBe(2500);
    expect(r.body.summary.thb.earned).toBe(87500);
    const bal = await as(admin.id).get('/admin/revenue/balances');
    expect(bal.body).toHaveLength(2);
    const csv = await as(admin.id).get('/admin/revenue.csv');
    expect(csv.text.split('\n')[0]).toContain('share_amount');
  });

  it('chart totals per day come from the database, in the viewer time zone, beyond the table limit', async () => {
    const { buyer, admin, c, p } = await setup();
    const o1 = await paidOrder(buyer.id, c.id, 10000, 'usd');
    const b2 = await makeUser();
    const o2 = await paidOrder(b2.id, c.id, 10000, 'usd');
    // 20:00 UTC on 17 Nov is already 18 Nov in Bangkok (UTC+7); 10:00 UTC on 18 Nov is 18 Nov too.
    await prisma.revenueEntry.updateMany({ where: { orderId: o1.id }, data: { createdAt: new Date('2026-11-17T20:00:00Z') } });
    await prisma.revenueEntry.updateMany({ where: { orderId: o2.id }, data: { createdAt: new Date('2026-11-18T10:00:00Z') } });

    const bkk = (await as(admin.id).get(`/admin/revenue?partner=${p.id}&tz=Asia/Bangkok`)).body;
    expect(bkk.daily).toEqual([{ day: '2026-11-18', currency: 'usd', amountMinor: 5000, entries: 2 }]);
    expect(bkk.total).toBe(2);
    const utc = (await as(admin.id).get(`/admin/revenue?partner=${p.id}`)).body;
    expect(utc.daily.map((d: { day: string }) => d.day)).toEqual(['2026-11-17', '2026-11-18']);
    const ranged = (await as(admin.id).get(`/admin/revenue?partner=${p.id}&from=2026-11-18T00:00:00Z&to=2026-11-18T23:59:59Z&status=UNPAID`)).body;
    expect(ranged.daily).toEqual([{ day: '2026-11-18', currency: 'usd', amountMinor: 2500, entries: 1 }]);
    expect((await as(admin.id).get('/admin/revenue?tz=Not/AZone')).status).toBe(400);
  });

  it('all partners together over 100% are refused', async () => {
    const { admin, p } = await setup(); // 25%
    const create = await as(admin.id).post('/admin/partners').send({ name: 'Big', sharePercentBp: 7600 });
    expect(create.status).toBe(400);
    const ok = await as(admin.id).post('/admin/partners').send({ name: 'Rest', sharePercentBp: 7500 });
    expect(ok.status).toBe(201);
    expect((await as(admin.id).patch(`/admin/partners/${p.id}`).send({ sharePercentBp: 2501 })).status).toBe(400);
    expect((await as(admin.id).patch(`/admin/partners/${p.id}`).send({ sharePercentBp: 2000 })).status).toBe(200);
  });
});
