import { beforeEach, describe, expect, it } from 'vitest';
import { markOrderPaid, markOrderRefunded } from '../src/lib/order-paid.js';
import { shareOf } from '../src/lib/money.js';
import { as, makeCourse, makeUser, prisma, resetDb } from './helpers.js';

async function setup() {
  const buyer = await makeUser();
  const admin = await makeUser('ADMIN');
  const c = await makeCourse({ isFree: false, priceMinor: 10000, priceThbMinor: 350000 });
  const p = await prisma.partner.create({ data: { name: 'Co-investor' } });
  await prisma.courseRevenueShare.create({ data: { courseId: c.id, partnerId: p.id, percentBp: 2500 } });
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
    expect(shareOf(-999, 3333)).toBe(-332);
  });

  it('stores percent at payment time', async () => {
    const { buyer, c, p } = await setup();
    const o1 = await paidOrder(buyer.id, c.id, 10000, 'usd');
    await prisma.courseRevenueShare.update({ where: { courseId_partnerId: { courseId: c.id, partnerId: p.id } }, data: { percentBp: 5000 } });
    const other = await makeUser();
    await paidOrder(other.id, c.id, 10000, 'usd');
    const e1 = await prisma.revenueEntry.findFirstOrThrow({ where: { orderId: o1.id } });
    expect(e1.percentBp).toBe(2500);
    expect(e1.amountMinor).toBe(2500);
    const all = await prisma.revenueEntry.findMany({ orderBy: { createdAt: 'asc' } });
    expect(all.map((e) => e.percentBp)).toEqual([2500, 5000]);
  });

  it('refund writes negative mirror entries', async () => {
    const { buyer, c, p } = await setup();
    const o = await paidOrder(buyer.id, c.id, 10000, 'usd');
    await prisma.courseRevenueShare.update({ where: { courseId_partnerId: { courseId: c.id, partnerId: p.id } }, data: { percentBp: 9000 } });
    await markOrderRefunded(o.id);
    await markOrderRefunded(o.id); // twice -> once
    const rows = await prisma.revenueEntry.findMany({ where: { orderId: o.id }, orderBy: { amountMinor: 'desc' } });
    expect(rows).toHaveLength(2);
    expect(rows[1].amountMinor).toBe(-2500);
    expect(rows[1].percentBp).toBe(2500);
    expect(rows[1].reversesId).toBe(rows[0].id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('REFUNDED');
    // Access is kept in v1.
    expect(await prisma.enrollment.count({ where: { userId: buyer.id } })).toBe(1);
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

  it('shares over 100% are refused', async () => {
    const { admin, c, p } = await setup();
    const p2 = await prisma.partner.create({ data: { name: 'Other' } });
    const r = await as(admin.id)
      .put(`/admin/courses/${c.id}/revenue-shares`)
      .send({ shares: [{ partnerId: p.id, percentBp: 6000 }, { partnerId: p2.id, percentBp: 5000 }] });
    expect(r.status).toBe(400);
  });
});
