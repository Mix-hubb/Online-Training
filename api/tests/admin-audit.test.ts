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

  it('create, lesson, quiz, status, approve: every mutation is logged', async () => {
    // 2026-11-27: instructors make courses, admins approve them.
    const admin = await makeUser('ADMIN');
    const ins = await makeUser('INSTRUCTOR');
    const created = await as(ins.id).post('/instructor/courses').send({ title: 'Audit course', summary: 'S' });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await as(ins.id).post(`/instructor/courses/${id}/lessons`).send({ title: 'L1' })).status).toBe(201);
    await as(ins.id).put(`/instructor/courses/${id}/quiz`).send({ passPercent: 70, timeLimitMin: null, maxAttempts: 3 });
    expect((await as(ins.id).post(`/instructor/courses/${id}/status`).send({ status: 'IN_REVIEW' })).status).toBe(200);
    expect((await as(admin.id).post(`/admin/courses/${id}/approve`)).status).toBe(200);
    const actions = (await prisma.auditLog.findMany({ where: { actorId: ins.id } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['course.create', 'lesson.create', 'quiz.update', 'course.status']));
    expect((await prisma.auditLog.findMany({ where: { actorId: admin.id } })).map((a) => a.action)).toContain('course.approve');
    const list = await as(admin.id).get('/admin/audit');
    expect(list.body.total).toBeGreaterThanOrEqual(5);
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
    const after = await prisma.lesson.findMany({ where: { courseId: c.id }, orderBy: { order: 'asc' } });
    expect(after.map((l) => l.id)).toEqual(ids);
    expect(after.map((l) => l.order)).toEqual([1, 2, 3]);
    expect(await prisma.auditLog.count({ where: { action: 'lesson.reorder' } })).toBe(1);
  });

  it('lesson reorder refuses a list that is not every lesson once, and changes nothing', async () => {
    const admin = await makeUser('ADMIN');
    const c = await makeCourse({ lessons: 3 });
    const other = await makeCourse({ lessons: 1 });
    const ids = c.lessons.map((l) => l.id);
    const put = (list: string[]) => as(admin.id).put(`/admin/courses/${c.id}/lessons/order`).send({ ids: list });
    expect((await put([ids[2]!, ids[1]!])).status).toBe(400); // one missing
    expect((await put([ids[2]!, ids[1]!, ids[1]!])).status).toBe(400); // duplicate
    expect((await put([ids[2]!, ids[1]!, other.lessons[0]!.id])).status).toBe(400); // another course's lesson
    const after = await prisma.lesson.findMany({ where: { courseId: c.id }, orderBy: { order: 'asc' } });
    expect(after.map((l) => l.id)).toEqual(ids);
    const o = await prisma.lesson.findUniqueOrThrow({ where: { id: other.lessons[0]!.id } });
    expect(o.order).toBe(1);
  });
});
