import { beforeEach, describe, expect, it } from 'vitest';
import { as, completeAllLessons, enroll, makeCourse, makeUser, optionIds, resetDb } from './helpers.js';

describe('answer review rule', () => {
  beforeEach(resetDb);

  async function attempt(answer: 'right' | 'wrong') {
    const u = await makeUser();
    const c = await makeCourse({ quiz: { passPercent: 100, maxAttempts: 3 } });
    const e = await enroll(u.id, c.id);
    await completeAllLessons(e.id);
    const start = await as(u.id).post(`/courses/${c.id}/quiz/start`);
    expect(start.status).toBe(201);
    // In-progress attempt must not leak the right option.
    expect(JSON.stringify(start.body)).not.toContain('isCorrect');
    const ids = optionIds(c);
    const sub = await as(u.id)
      .post(`/attempts/${start.body.id}/submit`)
      .send({ answers: [{ questionId: ids.questionId, optionId: ids[answer] }] });
    expect(sub.status).toBe(200);
    return { u, sub, attemptId: start.body.id as string };
  }

  it('no isCorrect for failed learner', async () => {
    const { u, sub, attemptId } = await attempt('wrong');
    expect(sub.body.attempt.passed).toBe(false);
    const view = await as(u.id).get(`/attempts/${attemptId}`);
    const text = JSON.stringify(view.body);
    expect(text).not.toContain('isCorrect');
    expect(text).not.toContain('correctOptionId');
    expect(view.body.review).toBeUndefined();
    expect(view.body.score).toBe(0);
    expect(view.body.attemptsLeft).toBe(2);
  });

  it('visible after pass', async () => {
    const { u, sub, attemptId } = await attempt('right');
    expect(sub.body.attempt.passed).toBe(true);
    const view = await as(u.id).get(`/attempts/${attemptId}`);
    expect(view.body.review).toHaveLength(1);
    expect(view.body.review[0].isRight).toBe(true);
    expect(view.body.review[0].correctOptionId).toBeTruthy();
  });

  it('pass issues a certificate with OT-YYYY-NNNNNN', async () => {
    const { u } = await attempt('right');
    const certs = await as(u.id).get('/me/certificates');
    expect(certs.body[0].number).toMatch(/^OT-\d{4}-\d{6}$/);
    const verify = await as(u.id).get(`/certificates/${certs.body[0].number}`);
    expect(verify.body.valid).toBe(true);
    const pdf = await as(u.id).get(`/me/certificates/${certs.body[0].id}/pdf`);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });
});
