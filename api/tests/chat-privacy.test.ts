import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as, enroll, makeCourse, makeUser, pngBase64, prisma, resetDb } from './helpers.js';

describe('chat privacy', () => {
  beforeEach(resetDb);

  it('learner sees only own threads', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const t = await as(a.id).post('/me/threads/support').send({ subject: 'Help', body: 'Hi' });
    expect(t.status).toBe(201);
    expect((await as(a.id).get('/me/threads')).body).toHaveLength(1);
    expect((await as(b.id).get('/me/threads')).body).toHaveLength(0);
    expect((await as(b.id).get(`/threads/${t.body.id}/messages`)).status).toBe(404);
    expect((await as(b.id).post(`/threads/${t.body.id}/messages`).send({ body: 'sneak' })).status).toBe(404);
    const admin = await makeUser('ADMIN');
    expect((await as(admin.id).get(`/threads/${t.body.id}/messages`)).status).toBe(200);
  });

  it('course thread only for enrolled learners; only assigned instructors read it', async () => {
    const learner = await makeUser();
    const outsider = await makeUser();
    const ins = await makeUser('INSTRUCTOR');
    const otherIns = await makeUser('INSTRUCTOR');
    const c = await makeCourse();
    await prisma.courseInstructor.create({ data: { courseId: c.id, userId: ins.id } });
    expect((await as(outsider.id).post(`/courses/${c.id}/threads`).send({ subject: 'Q', body: 'q' })).body.error.code).toBe('NOT_ENROLLED');
    await enroll(learner.id, c.id);
    const t = await as(learner.id).post(`/courses/${c.id}/threads`).send({ subject: 'Q', body: 'question' });
    expect(t.status).toBe(201);
    expect((await as(ins.id).get(`/threads/${t.body.id}/messages`)).status).toBe(200);
    expect((await as(otherIns.id).get(`/threads/${t.body.id}/messages`)).status).toBe(404);
    expect((await as(ins.id).get('/instructor/threads')).body).toHaveLength(1);
    // Instructor reply notifies the learner and shows unread.
    await as(ins.id).post(`/threads/${t.body.id}/messages`).send({ body: 'answer' });
    const mine = await as(learner.id).get('/me/threads');
    expect(mine.body[0].unread).toBe(1);
  });

  it('unread counts for staff and learner (one query for the whole inbox)', async () => {
    const admin = await makeUser('ADMIN');
    const a = await makeUser();
    const b = await makeUser();
    const ta = await as(a.id).post('/me/threads/support').send({ subject: 'A', body: 'first' });
    await as(a.id).post(`/threads/${ta.body.id}/messages`).send({ body: 'second' });
    const tb = await as(b.id).post('/me/threads/support').send({ subject: 'B', body: 'only' });
    const unreadOf = async () => Object.fromEntries((await as(admin.id).get('/admin/threads')).body.map((t: { id: string; unread: number }) => [t.id, t.unread]));
    expect(await unreadOf()).toEqual({ [ta.body.id]: 2, [tb.body.id]: 1 });

    await as(admin.id).post(`/threads/${ta.body.id}/read`);
    await as(admin.id).post(`/threads/${ta.body.id}/messages`).send({ body: 'reply' });
    expect((await unreadOf())[ta.body.id]).toBe(0); // staff's own reply is not unread for staff
    expect((await as(a.id).get('/me/threads')).body[0].unread).toBe(1);
    expect((await as(admin.id).get('/admin/threads?unread=true')).body.map((t: { id: string }) => t.id)).toEqual([tb.body.id]);
  });

  it('3 images max, 5 MB each, images only', async () => {
    const u = await makeUser();
    const t = await as(u.id).post('/me/threads/support').send({ subject: 'S', body: 'hi' });
    const img = { dataBase64: pngBase64(200) };
    const four = await as(u.id).post(`/threads/${t.body.id}/messages`).send({ body: 'x', attachments: [img, img, img, img] });
    expect(four.status).toBe(400);
    const big = await as(u.id).post(`/threads/${t.body.id}/messages`).send({ body: 'x', attachments: [{ dataBase64: pngBase64(5 * 1024 * 1024 + 10) }] });
    expect(big.body.error.code).toBe('ATTACHMENT_TOO_LARGE');
    const pdf = await as(u.id)
      .post(`/threads/${t.body.id}/messages`)
      .send({ body: 'x', attachments: [{ dataBase64: Buffer.from('%PDF-1.4 fake').toString('base64') }] });
    expect(pdf.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    const ok = await as(u.id).post(`/threads/${t.body.id}/messages`).send({ body: 'x', attachments: [img, img, img] });
    expect(ok.status).toBe(201);
    expect(ok.body.attachments).toHaveLength(3);
  });

  it('attachment links are signed and expire', async () => {
    const u = await makeUser();
    const other = await makeUser();
    const t = await as(u.id).post('/me/threads/support').send({ subject: 'S', body: 'hi', attachments: [{ dataBase64: pngBase64(300) }] });
    const msgs = await as(u.id).get(`/threads/${t.body.id}/messages`);
    const attId = msgs.body.messages[0].attachments[0].id;
    expect((await as(other.id).get(`/attachments/${attId}/url`)).status).toBe(404);
    const link = await as(u.id).get(`/attachments/${attId}/url`);
    const path = new URL(link.body.url).pathname + new URL(link.body.url).search;
    expect((await anon().get(path)).status).toBe(200);
    // Tampered or expired signature is refused.
    const expired = path.replace(/exp=\d+/, 'exp=1000');
    expect((await anon().get(expired)).status).toBe(403);
    expect((await anon().get(path.replace(/sig=[^&]+/, 'sig=bad'))).status).toBe(403);
  });
});
