import { beforeEach, describe, expect, it } from 'vitest';
import { as, makeCourse, makeUser, resetDb } from './helpers.js';

describe('pins', () => {
  beforeEach(resetDb);

  it('7th pin -> PIN_LIMIT', async () => {
    const u = await makeUser();
    const courses = [];
    for (let i = 0; i < 7; i++) courses.push(await makeCourse({ lessons: 1, quiz: false }));
    for (let i = 0; i < 6; i++) expect((await as(u.id).post(`/me/pins/${courses[i].id}`)).status).toBe(201);
    const seventh = await as(u.id).post(`/me/pins/${courses[6].id}`);
    expect(seventh.status).toBe(409);
    expect(seventh.body.error.code).toBe('PIN_LIMIT');
    // Pinning an already pinned course is fine.
    expect((await as(u.id).post(`/me/pins/${courses[0].id}`)).status).toBe(201);
    expect((await as(u.id).get('/me/pins')).body).toHaveLength(6);
  });

  it('parallel requests cannot pass the limit', async () => {
    const u = await makeUser();
    const courses = [];
    for (let i = 0; i < 8; i++) courses.push(await makeCourse({ lessons: 1, quiz: false }));
    await Promise.all(courses.map((c) => as(u.id).post(`/me/pins/${c.id}`)));
    expect((await as(u.id).get('/me/pins')).body).toHaveLength(6);
  });

  it('pins are per user', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const c = await makeCourse({ lessons: 1, quiz: false });
    await as(a.id).post(`/me/pins/${c.id}`);
    expect((await as(a.id).get('/me/pins')).body).toHaveLength(1);
    expect((await as(b.id).get('/me/pins')).body).toHaveLength(0);
    await as(a.id).delete(`/me/pins/${c.id}`);
    expect((await as(a.id).get('/me/pins')).body).toHaveLength(0);
  });
});
