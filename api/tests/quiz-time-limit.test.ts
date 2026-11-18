import { beforeEach, describe, expect, it } from 'vitest';
import { as, completeAllLessons, enroll, makeCourse, makeUser, optionIds, prisma, resetDb } from './helpers.js';

describe('server-side time limit', () => {
  beforeEach(resetDb);

  it('late submission rejected or auto-submitted', async () => {
    const u = await makeUser();
    const c = await makeCourse({ quiz: { timeLimitMin: 5, passPercent: 100, maxAttempts: 3 } });
    const e = await enroll(u.id, c.id);
    await completeAllLessons(e.id);
    const start = await as(u.id).post(`/courses/${c.id}/quiz/start`);
    const ids = optionIds(c);
    // Save a wrong answer in time.
    await as(u.id).put(`/attempts/${start.body.id}/answers`).send({ answers: [{ questionId: ids.questionId, optionId: ids.wrong }] });
    // Move the start 10 minutes back.
    await prisma.quizAttempt.update({ where: { id: start.body.id }, data: { startedAt: new Date(Date.now() - 10 * 60_000) } });

    const save = await as(u.id).put(`/attempts/${start.body.id}/answers`).send({ answers: [{ questionId: ids.questionId, optionId: ids.right }] });
    expect(save.body.error.code).toBe('ATTEMPT_EXPIRED');

    const a = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: start.body.id } });
    expect(a.status).toBe('GRADED');
    expect(a.passed).toBe(false); // the late "right" answer was not counted
  });

  it('late submit ignores answers sent after the deadline', async () => {
    const u = await makeUser();
    const c = await makeCourse({ quiz: { timeLimitMin: 5, passPercent: 100, maxAttempts: 3 } });
    const e = await enroll(u.id, c.id);
    await completeAllLessons(e.id);
    const start = await as(u.id).post(`/courses/${c.id}/quiz/start`);
    const ids = optionIds(c);
    await prisma.quizAttempt.update({ where: { id: start.body.id }, data: { startedAt: new Date(Date.now() - 10 * 60_000) } });
    const sub = await as(u.id).post(`/attempts/${start.body.id}/submit`).send({ answers: [{ questionId: ids.questionId, optionId: ids.right }] });
    expect(sub.body.late).toBe(true);
    expect(sub.body.attempt.passed).toBe(false);
  });

  it('double submit is refused', async () => {
    const u = await makeUser();
    const c = await makeCourse({ quiz: { passPercent: 100, maxAttempts: 3 } });
    const e = await enroll(u.id, c.id);
    await completeAllLessons(e.id);
    const start = await as(u.id).post(`/courses/${c.id}/quiz/start`);
    expect((await as(u.id).post(`/attempts/${start.body.id}/submit`).send({})).status).toBe(200);
    expect((await as(u.id).post(`/attempts/${start.body.id}/submit`).send({})).body.error.code).toBe('ATTEMPT_ALREADY_SUBMITTED');
  });
});
