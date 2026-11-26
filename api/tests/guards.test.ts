// CSRF Origin guard + write-route throttling (2026-11-26).
import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as, makeUser, prisma, resetDb } from './helpers.js';

beforeEach(resetDb);

describe('same-origin guard', () => {
  it('refuses a state-changing request sent from another site', async () => {
    const admin = await makeUser('ADMIN');
    const victim = await makeUser('USER');
    const r = await as(admin.id).post(`/admin/users/${victim.id}/ban`).set('Origin', 'https://evil.example');
    expect(r.status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: victim.id } })).status).toBe('ACTIVE');

    const ref = await as(admin.id).post(`/admin/users/${victim.id}/ban`).set('Referer', 'https://evil.example/page');
    expect(ref.status).toBe(403);
  });

  it('allows the web app, reads from anywhere, and requests with no Origin', async () => {
    const admin = await makeUser('ADMIN');
    const victim = await makeUser('USER');
    const ok = await as(admin.id).post(`/admin/users/${victim.id}/ban`).set('Origin', 'http://localhost:5173');
    expect(ok.status).toBe(200);
    expect((await anon().get('/categories').set('Origin', 'https://evil.example')).status).toBe(200);
    const noOrigin = await as(admin.id).post(`/admin/users/${victim.id}/unban`);
    expect(noOrigin.status).toBe(200);
  });

  it('does not block webhooks', async () => {
    const r = await anon().post('/bunny/webhook').set('Origin', 'https://video.bunnycdn.com').send({ VideoLibraryId: 1, VideoGuid: 'x' });
    expect(r.status).toBe(200);
  });
});

describe('throttle', () => {
  it('limits chat messages per user, not for everyone', async () => {
    const a = await makeUser('USER');
    const b = await makeUser('USER');
    const t = await as(a.id).post('/me/threads/support').send({ subject: 'Help', body: 'Hi' });
    expect(t.status).toBe(201);
    for (let i = 0; i < 19; i++) expect((await as(a.id).post(`/threads/${t.body.id}/messages`).send({ body: `m${i}` })).status).toBe(201);
    const blocked = await as(a.id).post(`/threads/${t.body.id}/messages`).send({ body: 'one too many' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect((await as(b.id).post('/me/threads/support').send({ subject: 'Other', body: 'Hi' })).status).toBe(201);
  });
});
