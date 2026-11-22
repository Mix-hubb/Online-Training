// Course pinning is admin-only (change 2026-11-22): pinned PUBLISHED courses list first, no label for learners.
import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as, makeCourse, makeUser, prisma, resetDb } from './helpers.js';

const ids = (body: { items: { id: string }[] }) => body.items.map((x) => x.id);

describe('admin course pins', () => {
  beforeEach(resetDb);

  it('pinned courses come first in pinOrder, then the normal order', async () => {
    const admin = await makeUser('ADMIN');
    const a = await makeCourse();
    const b = await makeCourse();
    const c = await makeCourse();
    const d = await makeCourse();
    // Normal order is newest first.
    await prisma.course.update({ where: { id: a.id }, data: { publishedAt: new Date(Date.now() - 4000) } });
    await prisma.course.update({ where: { id: b.id }, data: { publishedAt: new Date(Date.now() - 3000) } });
    await prisma.course.update({ where: { id: c.id }, data: { publishedAt: new Date(Date.now() - 2000) } });
    await prisma.course.update({ where: { id: d.id }, data: { publishedAt: new Date(Date.now() - 1000) } });
    expect(ids((await anon().get('/courses?pageSize=48')).body)).toEqual([d.id, c.id, b.id, a.id]);

    await as(admin.id).post(`/admin/courses/${a.id}/pin`);
    await as(admin.id).post(`/admin/courses/${c.id}/pin`);
    expect(ids((await anon().get('/courses?pageSize=48')).body)).toEqual([a.id, c.id, d.id, b.id]);

    const reorder = await as(admin.id).put('/admin/courses/pins').send({ ids: [c.id, a.id] });
    expect(reorder.status).toBe(200);
    const list = await anon().get('/courses?pageSize=48');
    expect(ids(list.body)).toEqual([c.id, a.id, d.id, b.id]);

    // Search/filter results follow the same rule.
    expect(ids((await anon().get('/courses?q=Course&level=BEGINNER&pageSize=48')).body)).toEqual([c.id, a.id, d.id, b.id]);

    // No "pinned" label or pinOrder for learners.
    expect(JSON.stringify(list.body)).not.toMatch(/pin/i);
    const learner = await makeUser();
    expect(JSON.stringify((await as(learner.id).get(`/courses/${a.slug}`)).body)).not.toMatch(/pin/i);
  });

  it('only PUBLISHED courses can be pinned; leaving PUBLISHED clears the pin', async () => {
    const admin = await makeUser('ADMIN');
    const draft = await makeCourse({ status: 'DRAFT' });
    const archived = await makeCourse({ status: 'ARCHIVED' });
    expect((await as(admin.id).post(`/admin/courses/${draft.id}/pin`)).status).toBe(400);
    expect((await as(admin.id).post(`/admin/courses/${archived.id}/pin`)).status).toBe(400);
    const pub = await makeCourse();
    expect((await as(admin.id).post(`/admin/courses/${pub.id}/pin`)).status).toBe(200);
    await as(admin.id).post(`/admin/courses/${pub.id}/status`).send({ status: 'ARCHIVED' });
    expect((await prisma.course.findUniqueOrThrow({ where: { id: pub.id } })).pinOrder).toBeNull();
  });

  it('no limit on pinned courses; unpin works; reorder must match the pinned set', async () => {
    const admin = await makeUser('ADMIN');
    const courses = [];
    for (let i = 0; i < 8; i++) courses.push(await makeCourse());
    for (const c of courses) expect((await as(admin.id).post(`/admin/courses/${c.id}/pin`)).status).toBe(200);
    expect((await as(admin.id).get('/admin/courses/pins')).body).toHaveLength(8);
    expect((await as(admin.id).delete(`/admin/courses/${courses[0].id}/pin`)).body).toHaveLength(7);
    expect((await as(admin.id).put('/admin/courses/pins').send({ ids: [courses[1].id] })).status).toBe(409);
  });

  it('only admins can pin', async () => {
    const c = await makeCourse();
    for (const role of ['USER', 'INSTRUCTOR', 'PARTNER'] as const) {
      const u = await makeUser(role);
      expect((await as(u.id).post(`/admin/courses/${c.id}/pin`)).status).toBe(403);
      expect((await as(u.id).put('/admin/courses/pins').send({ ids: [c.id] })).status).toBe(403);
    }
    expect((await anon().post(`/admin/courses/${c.id}/pin`)).status).toBe(401);
    const learner = await makeUser();
    expect((await as(learner.id).post(`/me/pins/${c.id}`)).status).toBe(404); // old learner pin API is gone
    expect((await prisma.course.findUniqueOrThrow({ where: { id: c.id } })).pinOrder).toBeNull();
  });
});
