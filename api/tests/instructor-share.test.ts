// Instructor share per assigned course (decided 2026-11-22): instructors are paid first, co-investors split what is left.
import { beforeEach, describe, expect, it } from 'vitest';
import { markOrderPaid } from '../src/lib/order-paid.js';
import { as, makeCourse, makeUser, prisma, resetDb } from './helpers.js';

async function paidOrder(userId: string, courseId: string, amountMinor: number, currency = 'usd') {
  const o = await prisma.order.create({ data: { userId, courseId, amountMinor, currency } });
  await markOrderPaid(o.id);
  return o;
}

async function setup() {
  const admin = await makeUser('ADMIN');
  const teacher = await makeUser('INSTRUCTOR');
  const course = await makeCourse({ isFree: false, priceMinor: 10000 });
  const other = await makeCourse({ isFree: false, priceMinor: 10000 });
  const investor = await prisma.partner.create({ data: { name: 'Co-investor', sharePercentBp: 2500 } });
  return { admin, teacher, course, other, investor };
}

describe('instructor share per course', () => {
  beforeEach(resetDb);

  it('instructor is paid first, the co-investor gets its percent of what is left', async () => {
    const { admin, teacher, course, investor } = await setup();
    const r = await as(admin.id).post(`/admin/courses/${course.id}/instructors`).send({ userId: teacher.id, sharePercentBp: 3000 });
    expect(r.status).toBe(201);
    expect(r.body[0].sharePercentBp).toBe(3000);

    const o = await paidOrder((await makeUser()).id, course.id, 10000);
    const rows = await prisma.revenueEntry.findMany({ where: { orderId: o.id }, include: { partner: true } });
    const mine = rows.find((e) => e.kind === 'INSTRUCTOR')!;
    const inv = rows.find((e) => e.kind === 'PARTNER')!;
    expect(mine.partner.userId).toBe(teacher.id);
    expect([mine.baseMinor, mine.percentBp, mine.amountMinor]).toEqual([10000, 3000, 3000]);
    // 25% of the 7000 left after the instructor.
    expect(inv.partnerId).toBe(investor.id);
    expect([inv.baseMinor, inv.percentBp, inv.amountMinor]).toEqual([7000, 2500, 1750]);
  });

  it('only on the courses the instructor is assigned to', async () => {
    const { admin, teacher, course, other } = await setup();
    await as(admin.id).post(`/admin/courses/${course.id}/instructors`).send({ userId: teacher.id, sharePercentBp: 3000 });
    const o = await paidOrder((await makeUser()).id, other.id, 10000);
    const rows = await prisma.revenueEntry.findMany({ where: { orderId: o.id } });
    expect(rows.map((e) => [e.kind, e.baseMinor, e.amountMinor])).toEqual([['PARTNER', 10000, 2500]]);
  });

  it('two instructors each get their own percent; together at most 100%', async () => {
    const { admin, teacher, course } = await setup();
    const second = await makeUser('INSTRUCTOR');
    await as(admin.id).post(`/admin/courses/${course.id}/instructors`).send({ userId: teacher.id, sharePercentBp: 6000 });
    const tooMuch = await as(admin.id).post(`/admin/courses/${course.id}/instructors`).send({ userId: second.id, sharePercentBp: 4001 });
    expect(tooMuch.status).toBe(400);
    expect((await as(admin.id).post(`/admin/courses/${course.id}/instructors`).send({ userId: second.id, sharePercentBp: 2000 })).status).toBe(201);
    expect((await as(admin.id).patch(`/admin/courses/${course.id}/instructors/${second.id}`).send({ sharePercentBp: 4001 })).status).toBe(400);

    const o = await paidOrder((await makeUser()).id, course.id, 10000);
    const rows = await prisma.revenueEntry.findMany({ where: { orderId: o.id }, orderBy: { amountMinor: 'desc' } });
    expect(rows.map((e) => [e.kind, e.amountMinor])).toEqual([
      ['INSTRUCTOR', 6000],
      ['INSTRUCTOR', 2000],
      ['PARTNER', 500], // 25% of the 2000 left
    ]);
  });

  it('a new percent only applies to later orders, and is audited', async () => {
    const { admin, teacher, course } = await setup();
    await as(admin.id).post(`/admin/courses/${course.id}/instructors`).send({ userId: teacher.id, sharePercentBp: 3000 });
    const first = await paidOrder((await makeUser()).id, course.id, 10000);
    const r = await as(admin.id).patch(`/admin/courses/${course.id}/instructors/${teacher.id}`).send({ sharePercentBp: 1000 });
    expect(r.status).toBe(200);
    const second = await paidOrder((await makeUser()).id, course.id, 10000);
    const amount = async (orderId: string) =>
      (await prisma.revenueEntry.findFirstOrThrow({ where: { orderId, kind: 'INSTRUCTOR' } })).amountMinor;
    expect(await amount(first.id)).toBe(3000);
    expect(await amount(second.id)).toBe(1000);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'instructor.share' } });
    expect(log.diff).toMatchObject({ userId: teacher.id, from: 3000, to: 1000 });
  });

  it('an instructor cannot get a share of all sales on the partners page', async () => {
    const { admin, teacher } = await setup();
    const linked = await as(admin.id).post('/admin/partners').send({ name: 'Teacher', userId: teacher.id, sharePercentBp: 1000 });
    expect(linked.status).toBe(400);
    const ok = await as(admin.id).post('/admin/partners').send({ name: 'Teacher', userId: teacher.id });
    expect(ok.status).toBe(201);
    expect((await as(admin.id).patch(`/admin/partners/${ok.body.id}`).send({ sharePercentBp: 500 })).status).toBe(400);
  });

  it("the instructor's earnings page lists the share of each assigned course", async () => {
    const { admin, teacher, course } = await setup();
    // Assigning with a share creates the earnings account.
    await as(admin.id).post(`/admin/courses/${course.id}/instructors`).send({ userId: teacher.id, sharePercentBp: 3000 });
    await paidOrder((await makeUser()).id, course.id, 10000);
    const r = await as(teacher.id).get('/instructor/earnings');
    expect(r.status).toBe(200);
    expect(r.body.linked).toBe(true);
    expect(r.body.courseShares).toEqual([expect.objectContaining({ id: course.id, sharePercentBp: 3000 })]);
    expect(r.body.totals.usd.earned).toBe(3000);
  });

  it('an instructor with no share gets no entry', async () => {
    const { admin, teacher, course } = await setup();
    await as(admin.id).post(`/admin/courses/${course.id}/instructors`).send({ userId: teacher.id });
    const o = await paidOrder((await makeUser()).id, course.id, 10000);
    const rows = await prisma.revenueEntry.findMany({ where: { orderId: o.id } });
    expect(rows.map((e) => e.kind)).toEqual(['PARTNER']);
    expect(await prisma.partner.count({ where: { userId: teacher.id } })).toBe(0);
  });
});
