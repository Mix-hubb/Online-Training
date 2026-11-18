import { beforeEach, describe, expect, it } from 'vitest';
import { capDelta, FIRST_DELTA_SEC, MAX_DELTA_SEC, recordProgress } from '../src/modules/learning/progress.service.js';
import { as, enroll, makeCourse, makeUser, prisma, resetDb } from './helpers.js';

describe('progress cap', () => {
  beforeEach(resetDb);

  it('caps by elapsed time + tolerance (pure)', () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    const t10 = new Date('2026-01-01T00:00:10Z');
    expect(capDelta(10, t0, t10)).toBe(10);
    expect(capDelta(300, t0, t10)).toBe(13); // 10 s elapsed + 3 s tolerance
    expect(capDelta(10, null, t10)).toBe(10);
    expect(capDelta(300, null, t10)).toBe(FIRST_DELTA_SEC);
    expect(capDelta(10_000, new Date(0), t10)).toBe(MAX_DELTA_SEC);
  });

  it('skipping ahead does not count as watched', async () => {
    const u = await makeUser();
    const c = await makeCourse({ durationSec: 600 });
    await enroll(u.id, c.id);
    const l1 = c.lessons[0];
    // Jump to the end in one report: only the first-report cap counts.
    const r1 = await as(u.id).put(`/lessons/${l1.id}/progress`).send({ position: 590, watchedDelta: 590 });
    expect(r1.status).toBe(200);
    expect(r1.body.watchedSec).toBe(FIRST_DELTA_SEC);
    expect(r1.body.completed).toBe(false);
    expect(r1.body.lastPositionSec).toBe(590);
    // Immediate second report: almost no time passed, so only the tolerance counts.
    const r2 = await as(u.id).put(`/lessons/${l1.id}/progress`).send({ position: 600, watchedDelta: 600 });
    expect(r2.body.watchedSec).toBeLessThanOrEqual(FIRST_DELTA_SEC + 4);
    expect(r2.body.completed).toBe(false);
  });

  it('honest 10 s reports add up', async () => {
    const u = await makeUser();
    const c = await makeCourse({ durationSec: 600 });
    const e = await enroll(u.id, c.id);
    const lesson = c.lessons[0];
    let now = new Date();
    for (let i = 0; i < 5; i++) {
      await recordProgress(e, lesson, { position: (i + 1) * 10, watchedDelta: 10 }, now);
      now = new Date(now.getTime() + 10_000);
    }
    const p = await prisma.lessonProgress.findFirstOrThrow({ where: { enrollmentId: e.id, lessonId: lesson.id } });
    expect(p.watchedSec).toBe(50);
  });

  it('negative delta rejected', async () => {
    const u = await makeUser();
    const c = await makeCourse();
    await enroll(u.id, c.id);
    const r = await as(u.id).put(`/lessons/${c.lessons[0].id}/progress`).send({ position: 10, watchedDelta: -5 });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('saves resume point on the enrollment', async () => {
    const u = await makeUser();
    const c = await makeCourse();
    const e = await enroll(u.id, c.id);
    await as(u.id).put(`/lessons/${c.lessons[0].id}/progress`).send({ position: 42, watchedDelta: 10 });
    const after = await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(after.lastLessonId).toBe(c.lessons[0].id);
    const play = await as(u.id).get(`/lessons/${c.lessons[0].id}/play`);
    expect(play.body.resumeAt).toBe(42);
  });
});
