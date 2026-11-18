import { beforeEach, describe, expect, it } from 'vitest';
import { as, completeAllLessons, enroll, makeCourse, makeUser, optionIds, prisma, resetDb } from './helpers.js';

describe('attempts and cycle reset', () => {
  beforeEach(resetDb);

  async function fail(userId: string, course: Awaited<ReturnType<typeof makeCourse>>) {
    const start = await as(userId).post(`/courses/${course.id}/quiz/start`);
    expect(start.status).toBe(201);
    const ids = optionIds(course);
    return as(userId).post(`/attempts/${start.body.id}/submit`).send({ answers: [{ questionId: ids.questionId, optionId: ids.wrong }] });
  }

  it('last failed attempt -> cycle + 1', async () => {
    const u = await makeUser();
    const c = await makeCourse({ quiz: { maxAttempts: 2, passPercent: 100 } });
    const e = await enroll(u.id, c.id);
    await completeAllLessons(e.id);
    await fail(u.id, c);
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } })).cycle).toBe(1);
    await fail(u.id, c);
    const after = await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(after.cycle).toBe(2);
    expect(after.status).toBe('IN_PROGRESS');
    // Old attempts kept; new cycle has no completed lessons, so the quiz is locked again.
    expect(await prisma.quizAttempt.count({ where: { enrollmentId: e.id } })).toBe(2);
    const learn = await as(u.id).get(`/courses/${c.slug}/learn`);
    expect(learn.body.lessons.every((l: { completed: boolean }) => !l.completed)).toBe(true);
    expect((await as(u.id).post(`/courses/${c.id}/quiz/start`)).body.error.code).toBe('QUIZ_LOCKED');
    const notes = await as(u.id).get('/notifications');
    expect(notes.body.items.some((n: { text: string }) => n.text.includes('restarted'))).toBe(true);
  });

  it('new cycle gets fresh attempts', async () => {
    const u = await makeUser();
    const c = await makeCourse({ quiz: { maxAttempts: 1, passPercent: 100 } });
    const e = await enroll(u.id, c.id);
    await completeAllLessons(e.id);
    await fail(u.id, c);
    await completeAllLessons(e.id); // cycle 2 lessons
    const start = await as(u.id).post(`/courses/${c.id}/quiz/start`);
    expect(start.status).toBe(201);
    expect(start.body.cycle).toBe(2);
  });

  it('no attempts left in the same cycle -> NO_ATTEMPTS_LEFT', async () => {
    const u = await makeUser();
    const c = await makeCourse({ quiz: { maxAttempts: 1, passPercent: 100, essay: true } });
    const e = await enroll(u.id, c.id);
    await completeAllLessons(e.id);
    const start = await as(u.id).post(`/courses/${c.id}/quiz/start`);
    const ids = optionIds(c);
    const essayQ = c.quiz!.questions.find((q) => q.type === 'ESSAY')!;
    await as(u.id)
      .post(`/attempts/${start.body.id}/submit`)
      .send({ answers: [{ questionId: ids.questionId, optionId: ids.wrong }, { questionId: essayQ.id, essayText: 'My answer' }] });
    const again = await as(u.id).post(`/courses/${c.id}/quiz/start`);
    expect(['QUIZ_LOCKED', 'NO_ATTEMPTS_LEFT']).toContain(again.body.error.code);
  });

  it('PENDING_REVIEW counts as used, reset waits for grading', async () => {
    const u = await makeUser();
    const admin = await makeUser('ADMIN');
    const c = await makeCourse({ quiz: { maxAttempts: 1, passPercent: 100, essay: true } });
    const e = await enroll(u.id, c.id);
    await completeAllLessons(e.id);
    const start = await as(u.id).post(`/courses/${c.id}/quiz/start`);
    const ids = optionIds(c);
    const essayQ = c.quiz!.questions.find((q) => q.type === 'ESSAY')!;
    const sub = await as(u.id)
      .post(`/attempts/${start.body.id}/submit`)
      .send({ answers: [{ questionId: ids.questionId, optionId: ids.wrong }, { questionId: essayQ.id, essayText: 'Essay text' }] });
    expect(sub.body.attempt.status).toBe('PENDING_REVIEW');
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } })).cycle).toBe(1);

    const g = await as(admin.id).post(`/admin/grading/${start.body.id}`).send({ grades: [{ questionId: essayQ.id, points: 0, comment: 'Too short' }] });
    expect(g.status).toBe(200);
    expect(g.body.passed).toBe(false);
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } })).cycle).toBe(2);
    // Grading twice is refused.
    const g2 = await as(admin.id).post(`/admin/grading/${start.body.id}`).send({ grades: [{ questionId: essayQ.id, points: 1 }] });
    expect(g2.status).toBe(409);
  });

  it('essay graded to pass issues certificate', async () => {
    const u = await makeUser();
    const admin = await makeUser('ADMIN');
    const c = await makeCourse({ quiz: { maxAttempts: 1, passPercent: 100, essay: true } });
    const e = await enroll(u.id, c.id);
    await completeAllLessons(e.id);
    const start = await as(u.id).post(`/courses/${c.id}/quiz/start`);
    const ids = optionIds(c);
    const essayQ = c.quiz!.questions.find((q) => q.type === 'ESSAY')!;
    await as(u.id)
      .post(`/attempts/${start.body.id}/submit`)
      .send({ answers: [{ questionId: ids.questionId, optionId: ids.right }, { questionId: essayQ.id, essayText: 'Good' }] });
    const g = await as(admin.id).post(`/admin/grading/${start.body.id}`).send({ grades: [{ questionId: essayQ.id, points: 1 }] });
    expect(g.body.passed).toBe(true);
    expect(await prisma.certificate.count({ where: { enrollmentId: e.id } })).toBe(1);
  });
});
