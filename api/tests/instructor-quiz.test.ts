// Instructors manage the final test of assigned courses only (change 2026-11-22).
import { beforeEach, describe, expect, it } from 'vitest';
import { as, makeCourse, makeUser, prisma, resetDb } from './helpers.js';

const settings = { passPercent: 80, timeLimitMin: 20, maxAttempts: 3 };
const mcq = { type: 'MCQ', text: 'Pick one', points: 2, options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: false }] };

async function setup() {
  const ins = await makeUser('INSTRUCTOR');
  const c = await makeCourse();
  await prisma.courseInstructor.create({ data: { courseId: c.id, userId: ins.id } });
  return { ins, c };
}

describe('instructor quiz management', () => {
  beforeEach(resetDb);

  it('assigned instructor can read and change settings and questions', async () => {
    const { ins, c } = await setup();
    const quizId = c.quiz!.id;
    expect((await as(ins.id).get(`/instructor/courses/${c.id}/quiz`)).body.questions).toHaveLength(1);
    const put = await as(ins.id).put(`/instructor/courses/${c.id}/quiz`).send(settings);
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject(settings);

    const created = await as(ins.id).post(`/instructor/quiz/${quizId}/questions`).send(mcq);
    expect(created.status).toBe(201);
    const edited = await as(ins.id).patch(`/instructor/questions/${created.body.id}`).send({ ...mcq, text: 'Edited' });
    expect(edited.body.text).toBe('Edited');
    const ids = [created.body.id, c.quiz!.questions[0].id];
    expect((await as(ins.id).put(`/instructor/quiz/${quizId}/questions/order`).send({ ids })).status).toBe(200);
    expect((await as(ins.id).delete(`/instructor/questions/${created.body.id}`)).status).toBe(200);
    expect(await prisma.question.count({ where: { quizId } })).toBe(1);
    // Instructor writes are audit-logged under the instructor's id.
    expect(await prisma.auditLog.count({ where: { actorId: ins.id } })).toBeGreaterThanOrEqual(4);
  });

  it('unassigned instructor gets NOT_ASSIGNED on every route', async () => {
    const { c } = await setup();
    const other = await makeUser('INSTRUCTOR');
    const quizId = c.quiz!.id;
    const qid = c.quiz!.questions[0].id;
    const calls = [
      as(other.id).get(`/instructor/courses/${c.id}/quiz`),
      as(other.id).put(`/instructor/courses/${c.id}/quiz`).send(settings),
      as(other.id).post(`/instructor/quiz/${quizId}/questions`).send(mcq),
      as(other.id).patch(`/instructor/questions/${qid}`).send(mcq),
      as(other.id).delete(`/instructor/questions/${qid}`),
      as(other.id).put(`/instructor/quiz/${quizId}/questions/order`).send({ ids: [qid] }),
    ];
    for (const r of await Promise.all(calls)) {
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('NOT_ASSIGNED');
    }
    expect(await prisma.question.count({ where: { quizId } })).toBe(1);
  });

  it('learners are FORBIDDEN; admins can use the same routes', async () => {
    const { c } = await setup();
    const learner = await makeUser();
    const r = await as(learner.id).put(`/instructor/courses/${c.id}/quiz`).send(settings);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN');
    const admin = await makeUser('ADMIN');
    expect((await as(admin.id).put(`/admin/courses/${c.id}/quiz`).send(settings)).status).toBe(200);
  });

  it('assigned instructor of an admin-run course still cannot edit course details or lessons', async () => {
    const { ins, c } = await setup();
    expect((await as(ins.id).patch(`/admin/courses/${c.id}`).send({ title: 'Hacked' })).status).toBe(403);
    expect((await as(ins.id).patch(`/instructor/courses/${c.id}`).send({ title: 'Hacked' })).status).toBe(403);
    expect((await as(ins.id).post(`/admin/courses/${c.id}/lessons`).send({ title: 'L' })).status).toBe(403);
    expect((await as(ins.id).post(`/instructor/courses/${c.id}/lessons`).send({ title: 'L' })).status).toBe(403);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: c.id } })).title).not.toBe('Hacked');
  });
});
