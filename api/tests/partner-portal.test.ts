import { beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { markOrderPaid } from '../src/lib/order-paid.js';
import { sentMails } from '../src/mail.js';
import { anon, as, makeCourse, makeUser, prisma, resetDb } from './helpers.js';

async function setup() {
  const admin = await makeUser('ADMIN');
  const buyer = await makeUser('USER', { email: `buyer-${Date.now()}@secret.test` });
  const c = await makeCourse({ isFree: false, priceMinor: 10000 });
  const mine = await prisma.partner.create({ data: { name: 'Mine Co', sharePercentBp: 2000 } });
  const other = await prisma.partner.create({ data: { name: 'Other Co', sharePercentBp: 3000 } });
  const o = await prisma.order.create({ data: { userId: buyer.id, courseId: c.id, amountMinor: 10000, currency: 'usd' } });
  await markOrderPaid(o.id);
  const acc = await as(admin.id).post(`/admin/partners/${mine.id}/account`).send({ email: 'mine@partner.test' });
  return { admin, buyer, c, mine, other, acc };
}

async function login(email: string, password: string) {
  const r = await anon().post('/auth/login').send({ email, password });
  const cookie = String(r.headers['set-cookie']?.[0] ?? '').split(';')[0];
  return { r, cookie };
}

describe('partner portal', () => {
  beforeEach(resetDb);

  it('temporary password is returned once and stored only as a hash', async () => {
    const { acc, mine } = await setup();
    expect(acc.status).toBe(201);
    const pw = acc.body.temporaryPassword as string;
    expect(pw.length).toBeGreaterThanOrEqual(15);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'mine@partner.test' } });
    expect(u.role).toBe('PARTNER');
    expect(u.passwordHash).not.toContain(pw);
    expect(await bcrypt.compare(pw, u.passwordHash!)).toBe(true);
    const logs = await prisma.auditLog.findMany();
    expect(JSON.stringify(logs)).not.toContain(pw);
    // The list never shows it again.
    const list = await as((await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } })).id).get('/admin/partners');
    expect(JSON.stringify(list.body)).not.toContain(pw);
    expect(list.body.find((p: { id: string }) => p.id === mine.id).user.mustChangePassword).toBe(true);
  });

  it('admin-created account must change password before anything else', async () => {
    const { acc } = await setup();
    const { r, cookie } = await login('mine@partner.test', acc.body.temporaryPassword);
    expect(r.body.user.mustChangePassword).toBe(true);
    expect((await anon().get('/partner/summary').set('Cookie', cookie)).body.error.code).toBe('MUST_CHANGE_PASSWORD');
    expect((await anon().get('/auth/me').set('Cookie', cookie)).status).toBe(200);
    const ch = await anon()
      .post('/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: acc.body.temporaryPassword, newPassword: 'My-own-pass-9' });
    expect(ch.body.user.mustChangePassword).toBe(false);
    expect((await anon().get('/partner/summary').set('Cookie', cookie)).status).toBe(200);
  });

  it('partner sees only own entries and payouts', async () => {
    const { mine, admin } = await setup();
    const u = await prisma.user.update({ where: { email: 'mine@partner.test' }, data: { mustChangePassword: false } });
    await as(admin.id).post('/admin/revenue/payouts').send({ partnerId: mine.id, currency: 'usd' });
    const rows = await as(u.id).get('/partner/revenue?partner=someone-else');
    expect(rows.body).toHaveLength(1);
    expect(rows.body[0].amountMinor).toBe(2000);
    const sum = await as(u.id).get('/partner/summary');
    expect(sum.body.totals.usd).toEqual({ earned: 2000, paid: 2000, outstanding: 0 });
    expect((await as(u.id).get('/partner/payouts')).body).toHaveLength(1);
  });

  it('responses never include buyer name or email', async () => {
    const { buyer } = await setup();
    const u = await prisma.user.update({ where: { email: 'mine@partner.test' }, data: { mustChangePassword: false } });
    for (const url of ['/partner/summary', '/partner/revenue', '/partner/revenue.csv', '/partner/payouts']) {
      const r = await as(u.id).get(url);
      const text = r.text;
      expect(text, url).not.toContain(buyer.email);
      expect(text, url).not.toContain(buyer.name);
      expect(text, url).not.toContain('Other Co');
    }
  });

  it('partner cannot open admin, instructor or learning routes', async () => {
    const { c } = await setup();
    const u = await prisma.user.update({ where: { email: 'mine@partner.test' }, data: { mustChangePassword: false } });
    expect((await as(u.id).get('/admin/dashboard')).status).toBe(403);
    expect((await as(u.id).get('/instructor/courses')).status).toBe(403);
    expect((await as(u.id).get('/me/courses')).status).toBe(403);
    expect((await as(u.id).post(`/courses/${c.id}/checkout`).send({})).status).toBe(403);
  });

  it('forgot-password email works for PARTNER and clears mustChangePassword', async () => {
    await setup();
    sentMails.length = 0;
    await anon().post('/auth/forgot-password').send({ email: 'mine@partner.test' });
    const mail = sentMails.find((m) => m.to === 'mine@partner.test');
    expect(mail).toBeTruthy();
    const token = /token=([\w-]+)/.exec(mail!.text)![1];
    expect((await anon().post('/auth/reset-password').send({ token, password: 'Fresh-pass-77' })).status).toBe(200);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'mine@partner.test' } });
    expect(u.mustChangePassword).toBe(false);
    const { r } = await login('mine@partner.test', 'Fresh-pass-77');
    expect(r.status).toBe(200);
    // The link works once.
    expect((await anon().post('/auth/reset-password').send({ token, password: 'Another-pass-1' })).status).toBe(400);
  });

  it('admin fallback reset sets a new temporary password and mustChangePassword = true', async () => {
    const { admin, mine, acc } = await setup();
    await prisma.user.update({ where: { email: 'mine@partner.test' }, data: { mustChangePassword: false } });
    const r = await as(admin.id).post(`/admin/partners/${mine.id}/account/reset-password`);
    expect(r.body.temporaryPassword).toBeTruthy();
    expect(r.body.temporaryPassword).not.toBe(acc.body.temporaryPassword);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'mine@partner.test' } });
    expect(u.mustChangePassword).toBe(true);
    expect((await login('mine@partner.test', acc.body.temporaryPassword)).r.status).toBe(401);
    expect((await login('mine@partner.test', r.body.temporaryPassword)).r.status).toBe(200);
  });

  it('banned partner is rejected', async () => {
    await setup();
    const u = await prisma.user.update({ where: { email: 'mine@partner.test' }, data: { mustChangePassword: false, status: 'BANNED' } });
    expect((await as(u.id).get('/partner/summary')).body.error.code).toBe('BANNED');
  });

  it('instructor with a share sees own earnings', async () => {
    const { c } = await setup();
    const ins = await makeUser('INSTRUCTOR');
    // Instructors are paid per assigned course (2026-11-22), not a share of all sales.
    await prisma.partner.create({ data: { name: 'Ins', userId: ins.id } });
    await prisma.courseInstructor.create({ data: { courseId: c.id, userId: ins.id, sharePercentBp: 500 } });
    const b = await makeUser();
    const o = await prisma.order.create({ data: { userId: b.id, courseId: c.id, amountMinor: 10000, currency: 'usd' } });
    await markOrderPaid(o.id);
    const r = await as(ins.id).get('/instructor/earnings');
    expect(r.body.linked).toBe(true);
    expect(r.body.rows).toHaveLength(1);
    expect(r.body.rows[0].amountMinor).toBe(500);
  });
});
