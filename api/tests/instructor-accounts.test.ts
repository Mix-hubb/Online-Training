import { beforeEach, describe, expect, it } from 'vitest';
import { markOrderPaid } from '../src/lib/order-paid.js';
import { anon, as, enroll, makeCourse, makeUser, prisma, resetDb } from './helpers.js';

describe('admin instructor accounts', () => {
  beforeEach(resetDb);

  it('creates an INSTRUCTOR login with a one-time temporary password', async () => {
    const admin = await makeUser('ADMIN');
    const r = await as(admin.id).post('/admin/instructors').send({ name: 'Napat S', email: 'Napat@Example.com' });
    expect(r.status).toBe(201);
    expect(r.body.temporaryPassword).toMatch(/.{8,}/);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'napat@example.com' } });
    expect(u).toMatchObject({ role: 'INSTRUCTOR', mustChangePassword: true, name: 'Napat S' });
    expect(u.emailVerifiedAt).not.toBeNull();
    expect(u.passwordHash).not.toContain(r.body.temporaryPassword);

    const login = await anon().post('/auth/login').send({ email: 'napat@example.com', password: r.body.temporaryPassword });
    expect(login.status).toBe(200);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'instructor.account_create' } });
    expect(JSON.stringify(log.diff)).not.toContain(r.body.temporaryPassword);
  });

  it('an existing learner email needs an explicit promote', async () => {
    const admin = await makeUser('ADMIN');
    const learner = await makeUser('USER', { email: 'teach@example.com' });
    const first = await as(admin.id).post('/admin/instructors').send({ name: 'X', email: 'teach@example.com' });
    expect(first.status).toBe(409);
    expect(first.body.error.code).toBe('ACCOUNT_EXISTS');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: learner.id } })).role).toBe('USER');

    const second = await as(admin.id).post('/admin/instructors').send({ name: 'X', email: 'teach@example.com', promoteExisting: true });
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ promoted: true, temporaryPassword: null });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: learner.id } })).role).toBe('INSTRUCTOR');
  });

  it('never turns a partner or admin into an instructor', async () => {
    const admin = await makeUser('ADMIN');
    await makeUser('PARTNER', { email: 'p@example.com' });
    const r = await as(admin.id).post('/admin/instructors').send({ name: 'P', email: 'p@example.com', promoteExisting: true });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('lists instructors with courses and shares; Users and Partners leave them out', async () => {
    const admin = await makeUser('ADMIN');
    const c = await makeCourse();
    const created = await as(admin.id).post('/admin/instructors').send({ name: 'Teacher One', email: 't1@example.com' });
    await as(admin.id).post(`/admin/courses/${c.id}/instructors`).send({ userId: created.body.id, sharePercentBp: 3000 });
    await makeUser('USER', { email: 'learner1@example.com' });
    await as(admin.id).post('/admin/partners').send({ name: 'Co-investor', sharePercentBp: 1000 });

    const list = await as(admin.id).get('/admin/instructors');
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({ email: 't1@example.com', courses: [{ id: c.id, sharePercentBp: 3000 }] });
    expect(list.body.items[0].partnerId).toBeTruthy();

    const users = await as(admin.id).get('/admin/users?roles=USER,ADMIN');
    expect(users.body.items.map((u: { role: string }) => u.role).sort()).toEqual(['ADMIN', 'USER']);

    const partners = await as(admin.id).get('/admin/partners');
    expect(partners.body.map((p: { name: string }) => p.name)).toEqual(['Co-investor']);
    const all = await as(admin.id).get('/admin/partners?include=instructors');
    expect(all.body).toHaveLength(2);
  });

  it('reset password gives a new temporary password and forces a change', async () => {
    const admin = await makeUser('ADMIN');
    const created = await as(admin.id).post('/admin/instructors').send({ name: 'T', email: 't2@example.com' });
    await prisma.user.update({ where: { id: created.body.id }, data: { mustChangePassword: false } });
    const r = await as(admin.id).post(`/admin/instructors/${created.body.id}/reset-password`);
    expect(r.status).toBe(200);
    expect(r.body.temporaryPassword).not.toBe(created.body.temporaryPassword);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: created.body.id } })).mustChangePassword).toBe(true);
    expect((await anon().post('/auth/login').send({ email: 't2@example.com', password: r.body.temporaryPassword })).status).toBe(200);
  });

  it('detail: assigned courses with share, co-instructor, learners, rating and earnings', async () => {
    const admin = await makeUser('ADMIN');
    const t = await makeUser('INSTRUCTOR');
    const co = await makeUser('INSTRUCTOR');
    const c = await makeCourse({ isFree: false, priceMinor: 10000 });
    await as(admin.id).post(`/admin/courses/${c.id}/instructors`).send({ userId: t.id, sharePercentBp: 3000 });
    await as(admin.id).post(`/admin/courses/${c.id}/instructors`).send({ userId: co.id, sharePercentBp: 2000 });
    const buyer = await makeUser();
    const o = await prisma.order.create({ data: { userId: buyer.id, courseId: c.id, amountMinor: 10000, currency: 'usd' } });
    await markOrderPaid(o.id);
    await prisma.courseReview.create({ data: { courseId: c.id, userId: buyer.id, rating: 4, body: 'Good course overall' } });
    const other = await makeUser();
    await enroll(other.id, c.id);

    const r = await as(admin.id).get(`/admin/instructors/${t.id}`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: t.id, name: t.name, status: 'ACTIVE' });
    expect(r.body.courses).toHaveLength(1);
    expect(r.body.courses[0]).toMatchObject({
      id: c.id,
      sharePercentBp: 3000,
      coInstructors: [{ id: co.id, name: co.name, sharePercentBp: 2000 }],
      learners: 2,
      rating: { average: 4, count: 1 },
      earned: [{ currency: 'usd', amountMinor: 3000 }],
    });
    expect(r.body.earnings).toEqual([{ currency: 'usd', earnedMinor: 3000, paidMinor: 0, unpaidMinor: 3000 }]);
    expect(r.body.recent).toHaveLength(1);
    expect(r.body.recent[0]).toMatchObject({ courseTitle: c.title, baseMinor: 10000, percentBp: 3000, amountMinor: 3000, status: 'UNPAID' });

    expect((await as(admin.id).get(`/admin/instructors/${buyer.id}`)).status).toBe(404);
    expect((await as(buyer.id).get(`/admin/instructors/${t.id}`)).status).toBe(403);
  });

  it('non-admins cannot create instructors', async () => {
    const u = await makeUser();
    expect((await as(u.id).post('/admin/instructors').send({ name: 'X', email: 'x@example.com' })).status).toBe(403);
  });
});
