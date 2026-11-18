import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as, makeUser, PASSWORD, prisma, resetDb } from './helpers.js';

describe('banned user', () => {
  beforeEach(resetDb);

  it('valid token + BANNED -> 403 BANNED on every route', async () => {
    const u = await makeUser('ADMIN');
    expect((await as(u.id).get('/auth/me')).status).toBe(200);
    await prisma.user.update({ where: { id: u.id }, data: { status: 'BANNED' } });
    for (const url of ['/auth/me', '/me/courses', '/notifications', '/orders', '/admin/dashboard', '/me/threads']) {
      const r = await as(u.id).get(url);
      expect(r.status, url).toBe(403);
      expect(r.body.error.code, url).toBe('BANNED');
    }
  });

  it('banned user cannot log in', async () => {
    const u = await makeUser('USER', { status: 'BANNED' });
    const r = await anon().post('/auth/login').send({ email: u.email, password: PASSWORD });
    expect(r.body.error.code).toBe('BANNED');
  });

  it('admin ban writes audit and cannot ban self', async () => {
    const admin = await makeUser('ADMIN');
    const u = await makeUser();
    expect((await as(admin.id).post(`/admin/users/${u.id}/ban`)).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'user.ban', entityId: u.id } })).toBe(1);
    expect((await as(admin.id).post(`/admin/users/${admin.id}/ban`)).status).toBe(400);
  });
});
