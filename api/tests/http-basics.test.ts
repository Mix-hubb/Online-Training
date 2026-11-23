import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as, makeUser, resetDb } from './helpers.js';

describe('http basics', () => {
  beforeEach(resetDb);

  it('big JSON bodies are refused outside upload routes', async () => {
    const r = await anon().post('/auth/login').set('Content-Type', 'application/json').send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(2 * 1024 * 1024) }));
    expect(r.status).toBe(413);
  });

  it('upload routes still accept a few MB', async () => {
    const admin = await makeUser('ADMIN');
    // 3 MB of base64 that is not an image: passes the size limit, then fails the image check (415, not 413).
    const r = await as(admin.id).post('/admin/uploads').send({ kind: 'cover', file: { dataBase64: 'A'.repeat(3 * 1024 * 1024) } });
    expect(r.status).toBe(415);
  });

  it('broken JSON is a 400, not a server error', async () => {
    const r = await anon().post('/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(r.status).toBe(400);
  });

  it('responses are gzipped and carry security headers', async () => {
    const r = await anon().get('/courses?pageSize=50').set('Accept-Encoding', 'gzip');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    // Small bodies (< 1 KB) are not compressed, so only check when there is something to compress.
    if (Number(r.headers['content-length'] ?? 2000) > 1024) expect(r.headers['content-encoding']).toBe('gzip');
  });
});
