import { beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { as, makeUser, pngBase64, resetDb } from './helpers.js';

const photo = async (w: number, h: number, fmt: 'png' | 'jpeg') =>
  (await sharp({ create: { width: w, height: h, channels: 3, background: '#3366aa' } })[fmt]().toBuffer()).toString('base64');

describe('image uploads are shrunk', () => {
  beforeEach(resetDb);

  it('a 4K logo becomes at most 640x320 and stays PNG/JPG (certificate PDF)', async () => {
    const admin = await makeUser('ADMIN');
    const r = await as(admin.id).post('/admin/uploads').send({ kind: 'logo', file: { dataBase64: await photo(3840, 2160, 'jpeg') } });
    expect(r.status).toBe(201);
    expect(r.body.url).toMatch(/\.jpg$/);
    expect(r.body.width).toBeLessThanOrEqual(640);
    expect(r.body.height).toBeLessThanOrEqual(320);
  });

  it('a cover becomes WebP, never enlarged', async () => {
    const admin = await makeUser('ADMIN');
    const big = await as(admin.id).post('/admin/uploads').send({ kind: 'cover', file: { dataBase64: await photo(4000, 2250, 'png') } });
    expect(big.body.url).toMatch(/\.webp$/);
    expect(big.body.width).toBe(2000);
    const small = await as(admin.id).post('/admin/uploads').send({ kind: 'cover', file: { dataBase64: await photo(320, 180, 'png') } });
    expect(small.status).toBe(201);
    expect(small.body.width ?? 320).toBe(320);
  });

  it('banner: a large photo is kept sharp (up to 2880 px), a fitting JPEG is stored exactly as uploaded', async () => {
    const admin = await makeUser('ADMIN');
    const big = await as(admin.id).post('/admin/uploads').send({ kind: 'banner', file: { dataBase64: await photo(6000, 3375, 'jpeg') } });
    expect(big.status).toBe(201);
    expect(big.body.url).toMatch(/\.webp$/);
    expect(big.body.width).toBe(2880);

    const fitting = await photo(1920, 1080, 'jpeg');
    const r = await as(admin.id).post('/admin/uploads').send({ kind: 'banner', file: { dataBase64: fitting } });
    expect(r.body.url).toMatch(/\.jpg$/);
    const stored = await as(admin.id).get(new URL(r.body.url).pathname);
    expect(Buffer.from(stored.body).toString('base64')).toBe(fitting);
  });

  it('admin images may be up to 15 MB; learner attachments keep the 5 MB limit', async () => {
    const admin = await makeUser('ADMIN');
    // Random pixels do not compress: a PNG well over 5 MB.
    const noise = Buffer.alloc(2200 * 1100 * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
    const heavy = (await sharp(noise, { raw: { width: 2200, height: 1100, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer()).toString('base64');
    expect(Buffer.from(heavy, 'base64').length).toBeGreaterThan(5 * 1024 * 1024);
    const r = await as(admin.id).post('/admin/uploads').send({ kind: 'banner', file: { dataBase64: heavy } });
    expect(r.status).toBe(201);
    expect(r.body.url).toMatch(/\.webp$/);
  });

  it('a broken image is refused with 415, not a server error', async () => {
    const admin = await makeUser('ADMIN');
    const broken = Buffer.from(pngBase64(200), 'base64').subarray(0, 40).toString('base64');
    const r = await as(admin.id).post('/admin/uploads').send({ kind: 'cover', file: { dataBase64: broken } });
    expect(r.status).toBe(415);
  });
});
