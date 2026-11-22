import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as, enroll, makeCourse, makeUser, prisma, resetDb } from './helpers.js';

async function completedLearner(courseId: string, name = 'Somchai Jaidee') {
  const u = await makeUser('USER');
  await prisma.user.update({ where: { id: u.id }, data: { name } });
  const e = await enroll(u.id, courseId);
  await prisma.enrollment.update({ where: { id: e.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
  return u;
}

describe('course reviews', () => {
  beforeEach(resetDb);

  it('only learners who completed the course can review', async () => {
    const c = await makeCourse();
    const stranger = await makeUser();
    const r1 = await as(stranger.id).put(`/me/courses/${c.id}/review`).send({ rating: 5, body: 'Great' });
    expect(r1.status).toBe(403);
    expect(r1.body.error.code).toBe('NOT_COMPLETED');

    const inProgress = await makeUser();
    await enroll(inProgress.id, c.id);
    expect((await as(inProgress.id).get(`/me/courses/${c.id}/review`)).body.canReview).toBe(false);
    expect((await as(inProgress.id).put(`/me/courses/${c.id}/review`).send({ rating: 4, body: 'Ok' })).body.error.code).toBe('NOT_COMPLETED');

    const done = await completedLearner(c.id);
    expect((await as(done.id).get(`/me/courses/${c.id}/review`)).body).toMatchObject({ canReview: true, review: null });
    const ok = await as(done.id).put(`/me/courses/${c.id}/review`).send({ rating: 5, body: '  Clear and useful.  ' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ rating: 5, body: 'Clear and useful.', status: 'VISIBLE' });

    expect((await anon().put(`/me/courses/${c.id}/review`).send({ rating: 5, body: 'x' })).status).toBe(401);
  });

  it('one review per learner per course; a second PUT edits it', async () => {
    const c = await makeCourse();
    const u = await completedLearner(c.id);
    await as(u.id).put(`/me/courses/${c.id}/review`).send({ rating: 3, body: 'First' });
    await as(u.id).put(`/me/courses/${c.id}/review`).send({ rating: 4, body: 'Edited' });
    const rows = await prisma.courseReview.findMany({ where: { courseId: c.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rating: 4, body: 'Edited' });
  });

  it('validates rating 1..5 and a non-empty body', async () => {
    const c = await makeCourse();
    const u = await completedLearner(c.id);
    for (const bad of [{ rating: 0, body: 'x' }, { rating: 6, body: 'x' }, { rating: 4.5, body: 'x' }, { rating: 5, body: '   ' }, { rating: 5, body: 'x'.repeat(2001) }]) {
      expect((await as(u.id).put(`/me/courses/${c.id}/review`).send(bad)).status).toBe(400);
    }
  });

  it('public list shows visible reviews with a short name and a summary', async () => {
    const c = await makeCourse();
    const a = await completedLearner(c.id, 'Somchai Jaidee');
    const b = await completedLearner(c.id, 'Nida');
    await as(a.id).put(`/me/courses/${c.id}/review`).send({ rating: 5, body: 'A' });
    await as(b.id).put(`/me/courses/${c.id}/review`).send({ rating: 2, body: 'B' });

    const r = await anon().get(`/courses/${c.slug}/reviews`);
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(2);
    expect(r.body.summary).toMatchObject({ average: 3.5, count: 2, distribution: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 } });
    expect(r.body.items.map((i: { author: string }) => i.author).sort()).toEqual(['Nida', 'Somchai J.']);
    expect(JSON.stringify(r.body)).not.toContain('@');

    const detail = await anon().get(`/courses/${c.slug}`);
    expect(detail.body.rating).toEqual({ average: 3.5, count: 2 });
  });

  it('admin hides, shows and deletes; hidden reviews leave the public list and summary', async () => {
    const admin = await makeUser('ADMIN');
    const c = await makeCourse();
    const u = await completedLearner(c.id);
    const mine = await as(u.id).put(`/me/courses/${c.id}/review`).send({ rating: 1, body: 'Spam link here' });

    const list = await as(admin.id).get(`/admin/reviews?courseId=${c.id}`);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].user.email).toBeTruthy();

    const hide = await as(admin.id).patch(`/admin/reviews/${mine.body.id}`).send({ status: 'HIDDEN', reason: 'Spam' });
    expect(hide.body).toMatchObject({ status: 'HIDDEN', hiddenReason: 'Spam' });
    const pub = await anon().get(`/courses/${c.slug}/reviews`);
    expect(pub.body.total).toBe(0);
    expect(pub.body.summary.count).toBe(0);
    expect((await as(admin.id).get('/admin/reviews?status=HIDDEN')).body.total).toBe(1);

    // the learner still sees their own review and editing it does not make it public again
    expect((await as(u.id).get(`/me/courses/${c.id}/review`)).body.review.status).toBe('HIDDEN');
    await as(u.id).put(`/me/courses/${c.id}/review`).send({ rating: 2, body: 'Edited' });
    expect((await anon().get(`/courses/${c.slug}/reviews`)).body.total).toBe(0);

    const show = await as(admin.id).patch(`/admin/reviews/${mine.body.id}`).send({ status: 'VISIBLE' });
    expect(show.body).toMatchObject({ status: 'VISIBLE', hiddenReason: null });
    expect(show.body.updatedAt).toBe((await prisma.courseReview.findUniqueOrThrow({ where: { id: mine.body.id } })).updatedAt.toISOString());

    expect((await as(admin.id).delete(`/admin/reviews/${mine.body.id}`)).status).toBe(204);
    expect(await prisma.courseReview.count()).toBe(0);

    const actions = (await prisma.auditLog.findMany({ where: { entity: 'CourseReview' }, orderBy: { at: 'asc' } })).map((a) => a.action);
    expect(actions).toEqual(['review.hide', 'review.show', 'review.delete']);
  });

  it('hiding and showing does not mark a review as edited', async () => {
    const admin = await makeUser('ADMIN');
    const c = await makeCourse();
    const u = await completedLearner(c.id);
    const mine = await as(u.id).put(`/me/courses/${c.id}/review`).send({ rating: 5, body: 'Fine' });
    await new Promise((r) => setTimeout(r, 1100));
    await as(admin.id).patch(`/admin/reviews/${mine.body.id}`).send({ status: 'HIDDEN' });
    await as(admin.id).patch(`/admin/reviews/${mine.body.id}`).send({ status: 'VISIBLE' });
    expect((await anon().get(`/courses/${c.slug}/reviews`)).body.items[0].edited).toBe(false);
  });

  it('non-admins cannot moderate', async () => {
    const c = await makeCourse();
    const u = await completedLearner(c.id);
    const mine = await as(u.id).put(`/me/courses/${c.id}/review`).send({ rating: 5, body: 'Mine' });
    expect((await as(u.id).get('/admin/reviews')).body.error.code).toBe('FORBIDDEN');
    expect((await as(u.id).patch(`/admin/reviews/${mine.body.id}`).send({ status: 'HIDDEN' })).status).toBe(403);
  });

  it('a learner can delete their own review', async () => {
    const c = await makeCourse();
    const u = await completedLearner(c.id);
    await as(u.id).put(`/me/courses/${c.id}/review`).send({ rating: 5, body: 'Mine' });
    expect((await as(u.id).delete(`/me/courses/${c.id}/review`)).status).toBe(204);
    expect(await prisma.courseReview.count()).toBe(0);
  });
});
