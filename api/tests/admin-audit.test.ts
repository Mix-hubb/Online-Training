import { beforeEach, describe, expect, it } from 'vitest';
import { as, makeCourse, makeUser, prisma, resetDb } from './helpers.js';

describe('admin audit log', () => {
  beforeEach(resetDb);

  it('course update writes a row', async () => {
    const admin = await makeUser('ADMIN');
    const c = await makeCourse();
    const r = await as(admin.id).patch(`/admin/courses/${c.id}`).send({ title: 'New title' });
    expect(r.status).toBe(200);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'course.update', entityId: c.id } });
    expect(log.actorId).toBe(admin.id);
  });

  it('create, lesson, quiz, status: every mutation is logged', async () => {
    const admin = await makeUser('ADMIN');
    const created = await as(admin.id).post('/admin/courses').send({ title: 'Audit course', summary: 'S' });
    expect(created.status).toBe(201);
    const id = created.body.id;
    await as(admin.id).post(`/admin/courses/${id}/lessons`).send({ title: 'L1' });
    await as(admin.id).put(`/admin/courses/${id}/quiz`).send({ passPercent: 70, timeLimitMin: null, maxAttempts: 3 });
    await as(admin.id).post(`/admin/courses/${id}/status`).send({ status: 'PUBLISHED' });
    const actions = (await prisma.auditLog.findMany({ where: { actorId: admin.id } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['course.create', 'lesson.create', 'quiz.update', 'course.status']));
    const list = await as(admin.id).get('/admin/audit');
    expect(list.body.total).toBeGreaterThanOrEqual(4);
  });

  it('non-admins cannot open admin routes', async () => {
    const u = await makeUser();
    expect((await as(u.id).get('/admin/courses')).body.error.code).toBe('FORBIDDEN');
  });

  it('MCQ needs exactly one correct option', async () => {
    const admin = await makeUser('ADMIN');
    const c = await makeCourse();
    const bad = await as(admin.id)
      .post(`/admin/quiz/${c.quiz!.id}/questions`)
      .send({ type: 'MCQ', text: 'Q', options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: true }] });
    expect(bad.status).toBe(400);
  });

  it('lesson reorder keeps unique order', async () => {
    const admin = await makeUser('ADMIN');
    const c = await makeCourse({ lessons: 3 });
    const ids = c.lessons.map((l) => l.id).reverse();
    const r = await as(admin.id).put(`/admin/courses/${c.id}/lessons/order`).send({ ids });
    expect(r.status).toBe(200);
    expect(r.body.map((l: { id: string }) => l.id)).toEqual(ids);
  });
});
