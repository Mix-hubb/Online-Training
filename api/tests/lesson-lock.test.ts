import { beforeEach, describe, expect, it } from 'vitest';
import { lessonStates, quizUnlocked } from '../src/modules/learning/lock.service.js';
import { as, completeAllLessons, enroll, makeCourse, makeUser, prisma, resetDb } from './helpers.js';

describe('lesson lock order', () => {
  beforeEach(resetDb);

  it('pure states', () => {
    const s = lessonStates(['a', 'b', 'c'], new Set(['a']));
    expect(s.map((x) => x.unlocked)).toEqual([true, true, false]);
    expect(quizUnlocked(['a', 'b'], new Set(['a']))).toBe(false);
    expect(quizUnlocked(['a', 'b'], new Set(['a', 'b']))).toBe(true);
    expect(quizUnlocked([], new Set())).toBe(false);
  });

  it('lesson 2 locked until lesson 1 completed', async () => {
    const u = await makeUser();
    const c = await makeCourse({ lessons: 2 });
    const e = await enroll(u.id, c.id);
    const [l1, l2] = c.lessons;
    expect((await as(u.id).get(`/lessons/${l2.id}/play`)).body.error.code).toBe('LOCKED');
    expect((await as(u.id).put(`/lessons/${l2.id}/progress`).send({ position: 1, watchedDelta: 1 })).body.error.code).toBe('LOCKED');
    await prisma.lessonProgress.create({ data: { enrollmentId: e.id, lessonId: l1.id, cycle: 1, watchedSec: 100, completed: true } });
    const ok = await as(u.id).get(`/lessons/${l2.id}/play`);
    expect(ok.status).toBe(200);
    expect(ok.body.url).toBeTruthy();
  });

  it('quiz locked until all lessons completed', async () => {
    const u = await makeUser();
    const c = await makeCourse({ lessons: 2 });
    const e = await enroll(u.id, c.id);
    const r = await as(u.id).post(`/courses/${c.id}/quiz/start`);
    expect(r.body.error.code).toBe('QUIZ_LOCKED');
    await completeAllLessons(e.id);
    const ok = await as(u.id).post(`/courses/${c.id}/quiz/start`);
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe('IN_PROGRESS');
  });

  it('video URL only for owners or staff', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const admin = await makeUser('ADMIN');
    const c = await makeCourse();
    await enroll(owner.id, c.id);
    expect((await as(stranger.id).get(`/lessons/${c.lessons[0].id}/play`)).body.error.code).toBe('NOT_ENROLLED');
    expect((await as(admin.id).get(`/lessons/${c.lessons[1].id}/play`)).status).toBe(200);
    // The public course page never shows video ids.
    const pub = await as(stranger.id).get(`/courses/${c.slug}`);
    expect(JSON.stringify(pub.body)).not.toContain('dev-');
  });
});
