import { beforeEach, describe, expect, it } from 'vitest';
import { as, completeAllLessons, enroll, makeCourse, makeUser, optionIds, prisma, resetDb } from './helpers.js';

describe('instructor scope', () => {
  beforeEach(resetDb);

  it('max 2 instructors per course', async () => {
    const admin = await makeUser('ADMIN');
    const c = await makeCourse();
    const [a, b, d] = await Promise.all([makeUser('INSTRUCTOR'), makeUser('INSTRUCTOR'), makeUser('INSTRUCTOR')]);
    expect((await as(admin.id).post(`/admin/courses/${c.id}/instructors`).send({ userId: a.id })).status).toBe(201);
    expect((await as(admin.id).post(`/admin/courses/${c.id}/instructors`).send({ userId: b.id })).status).toBe(201);
    const third = await as(admin.id).post(`/admin/courses/${c.id}/instructors`).send({ userId: d.id });
    expect(third.body.error.code).toBe('INSTRUCTOR_LIMIT');
    expect(await prisma.courseInstructor.count({ where: { courseId: c.id } })).toBe(2);
  });

  it('cannot edit course content', async () => {
    const ins = await makeUser('INSTRUCTOR');
    const c = await makeCourse();
    await prisma.courseInstructor.create({ data: { courseId: c.id, userId: ins.id } });
    expect((await as(ins.id).patch(`/admin/courses/${c.id}`).send({ title: 'x' })).body.error.code).toBe('FORBIDDEN');
    expect((await as(ins.id).post(`/admin/courses/${c.id}/lessons`).send({ title: 'x' })).body.error.code).toBe('FORBIDDEN');
    expect((await as(ins.id).put(`/admin/courses/${c.id}/quiz`).send({ passPercent: 1, timeLimitMin: null, maxAttempts: 1 })).status).toBe(403);
  });

  it('cannot see unassigned courses', async () => {
    const ins = await makeUser('INSTRUCTOR');
    const mine = await makeCourse();
    const other = await makeCourse();
    await prisma.courseInstructor.create({ data: { courseId: mine.id, userId: ins.id } });
    const list = await as(ins.id).get('/instructor/courses');
    expect(list.body.map((c: { id: string }) => c.id)).toEqual([mine.id]);
    expect((await as(ins.id).get(`/instructor/courses/${other.id}/learners`)).body.error.code).toBe('NOT_ASSIGNED');
    expect((await as(ins.id).get(`/instructor/courses/${mine.id}/learners`)).status).toBe(200);
  });

  it('grades essays only in assigned courses', async () => {
    const ins = await makeUser('INSTRUCTOR');
    const learner = await makeUser();
    const c = await makeCourse({ quiz: { essay: true, maxAttempts: 2 } });
    const e = await enroll(learner.id, c.id);
    await completeAllLessons(e.id);
    const start = await as(learner.id).post(`/courses/${c.id}/quiz/start`);
    const ids = optionIds(c);
    const essayQ = c.quiz!.questions.find((q) => q.type === 'ESSAY')!;
    await as(learner.id)
      .post(`/attempts/${start.body.id}/submit`)
      .send({ answers: [{ questionId: ids.questionId, optionId: ids.right }, { questionId: essayQ.id, essayText: 'x' }] });

    expect((await as(ins.id).get('/instructor/grading')).body).toHaveLength(0);
    expect((await as(ins.id).post(`/instructor/grading/${start.body.id}`).send({ grades: [{ questionId: essayQ.id, points: 1 }] })).body.error.code).toBe('NOT_ASSIGNED');

    await prisma.courseInstructor.create({ data: { courseId: c.id, userId: ins.id } });
    expect((await as(ins.id).get('/instructor/grading')).body).toHaveLength(1);
    const g = await as(ins.id).post(`/instructor/grading/${start.body.id}`).send({ grades: [{ questionId: essayQ.id, points: 1 }] });
    expect(g.body.passed).toBe(true);
  });

  it('learners cannot open instructor routes', async () => {
    const u = await makeUser();
    expect((await as(u.id).get('/instructor/courses')).body.error.code).toBe('FORBIDDEN');
  });
});
