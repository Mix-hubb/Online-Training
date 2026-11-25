// Bunny Storage + Bunny Stream wiring (2026-11-25), against a fake Bunny (fetch is stubbed; no account needed).
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(process.env, {
    BUNNY_STORAGE_ZONE: 'ot-public',
    BUNNY_STORAGE_KEY: 'pub-key',
    BUNNY_STORAGE_CDN_URL: 'ot-public.b-cdn.net/', // no https, trailing slash: normalised
    BUNNY_STORAGE_PRIVATE_ZONE: 'ot-private',
    BUNNY_STORAGE_PRIVATE_KEY: 'priv-key',
    BUNNY_STORAGE_HOST: 'sg.storage.bunnycdn.com',
    BUNNY_STREAM_LIBRARY_ID: '123',
    BUNNY_STREAM_API_KEY: 'stream-key',
    BUNNY_STREAM_TOKEN_KEY: 'token-key',
    BUNNY_CDN_HOSTNAME: 'https://vz-abc.b-cdn.net/',
  });
});

import { anon, as, makeCourse, makeUser, pngBase64, prisma, resetDb } from './helpers.js';
import { storage } from '../src/providers/storage/index.js';

const files = new Map<string, { body: Buffer; type: string }>();
const calls: { method: string; url: string; key: string }[] = [];
let streamStatus = 3;
const realFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method ?? 'GET';
  const key = String((init?.headers as Record<string, string> | undefined)?.AccessKey ?? '');
  calls.push({ method, url, key });
  if (url.startsWith('https://sg.storage.bunnycdn.com/')) {
    if (method === 'PUT') {
      files.set(url, { body: Buffer.from(init!.body as Uint8Array), type: String((init!.headers as Record<string, string>)['Content-Type']) });
      return new Response(null, { status: 201 });
    }
    const f = files.get(url);
    // Real Bunny Storage answers application/octet-stream whatever was uploaded.
    return f ? new Response(new Uint8Array(f.body), { status: 200, headers: { 'content-type': 'application/octet-stream' } }) : new Response(null, { status: 404 });
  }
  if (url.startsWith('https://video.bunnycdn.com/library/123/videos/')) {
    return Response.json({ status: streamStatus, length: 321, height: 1080, availableResolutions: '720p,1080p' });
  }
  return realFetch(input, init);
}) as typeof fetch;

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe('Bunny Storage', () => {
  beforeEach(async () => {
    await resetDb();
    files.clear();
    calls.length = 0;
  });

  it('public images go to the public zone and are served from the CDN', async () => {
    const admin = await makeUser('ADMIN');
    const r = await as(admin.id).post('/admin/uploads').send({ kind: 'logo', file: { dataBase64: pngBase64() } });
    expect(r.status).toBe(201);
    expect(r.body.url).toMatch(/^https:\/\/ot-public\.b-cdn\.net\/logo\/[0-9a-f-]+\.png$/);
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.url).toMatch(/^https:\/\/sg\.storage\.bunnycdn\.com\/ot-public\/logo\//);
    expect(put.key).toBe('pub-key');
  });

  it('private files go to the private zone and are read back only through a signed api link', async () => {
    await storage.putPrivate('slips/abc/file-1.webp', Buffer.from('slip-bytes'), 'image/webp');
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.url).toBe('https://sg.storage.bunnycdn.com/ot-private/slips/abc/file-1.webp');
    expect(put.key).toBe('priv-key');

    const url = new URL(await storage.signedUrl('slips/abc/file-1.webp', 60));
    expect(url.origin).toBe('http://localhost:4000'); // the api, never the CDN
    const ok = await anon().get(url.pathname + url.search);
    expect(ok.status).toBe(200);
    expect(ok.headers['cache-control']).toBe('private, no-store');
    expect(ok.headers['content-type']).toBe('image/webp'); // from the file name, so the <img> shows
    expect(Buffer.from(ok.body).toString()).toBe('slip-bytes');

    const forged = await anon().get(`${url.pathname}?exp=${url.searchParams.get('exp')}&sig=nope`);
    expect(forged.status).toBe(403);
  });
});

describe('Bunny Stream webhook', () => {
  beforeEach(resetDb);

  it('marks the lesson ready from Bunny API status, not from the webhook body', async () => {
    const course = await makeCourse({ lessons: 1 });
    const lesson = course.lessons[0];
    await prisma.lesson.update({ where: { id: lesson.id }, data: { bunnyVideoId: 'vid-1', videoStatus: 'PROCESSING' } });

    streamStatus = 3; // still encoding at Bunny, whatever the body says
    await anon().post('/bunny/webhook').send({ VideoLibraryId: 123, VideoGuid: 'vid-1', Status: 4 }).expect(200);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).videoStatus).toBe('PROCESSING');

    streamStatus = 4;
    const r = await anon().post('/bunny/webhook').send({ VideoLibraryId: 123, VideoGuid: 'vid-1', Status: 4 });
    expect(r.body).toMatchObject({ received: true, lessons: 1 });
    const after = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id }, include: { renditions: true } });
    expect(after.videoStatus).toBe('READY');
    expect(after.durationSec).toBe(321);
    expect(after.renditions.filter((x) => x.ready).map((x) => x.height).sort()).toEqual([1080, 720]);
  });

  it('playback links use the stream pull zone host and a directory token', async () => {
    const { video } = await import('../src/providers/video/index.js');
    const u = await video.getSignedPlaybackUrl('vid-1', 600);
    expect(u).toMatch(/^https:\/\/vz-abc\.b-cdn\.net\/bcdn_token=[\w-]+&expires=\d+&token_path=%2Fvid-1%2F\/vid-1\/playlist\.m3u8$/);
  });

  it('ignores another library', async () => {
    const r = await anon().post('/bunny/webhook').send({ VideoLibraryId: 999, VideoGuid: 'vid-1', Status: 4 });
    expect(r.body).toEqual({ received: false });
  });
});
