// Final test editor. The same router is mounted under /admin (ADMIN) and /instructor (2026-11-22):
//   GET/PUT {base}/courses/:id/quiz       (passPercent, timeLimitMin, maxAttempts)
//   POST    {base}/quiz/:quizId/questions
//   PATCH   {base}/questions/:id
//   DELETE  {base}/questions/:id
//   PUT     {base}/quiz/:quizId/questions/order  { ids }
// Access: ADMIN, or an INSTRUCTOR assigned to the quiz's course (CourseInstructor); otherwise NOT_ASSIGNED.
// Instructors can edit only the test: course details and lessons stay admin-only.
// MCQ: at least 2 options and exactly one correct.
import { Router } from 'express';
import type { User } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { isAssigned } from '../../middleware/roles.js';

export const quizAdminRouter = Router();

/** ADMIN passes; an instructor must be assigned to the course. Anyone else: FORBIDDEN. */
async function assertQuizAccess(user: User | undefined, courseId: string) {
  if (user?.role === 'ADMIN') return;
  if (user?.role !== 'INSTRUCTOR') throw new AppError('FORBIDDEN', 403);
  if (!(await isAssigned(user.id, courseId))) throw new AppError('NOT_ASSIGNED', 403);
}

async function courseOfQuiz(quizId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new AppError('NOT_FOUND', 404);
  return quiz;
}

async function questionWithCourse(id: string) {
  const q = await prisma.question.findUnique({ where: { id }, include: { quiz: { select: { courseId: true } } } });
  if (!q) throw new AppError('NOT_FOUND', 404);
  return q;
}

const settings = z.object({
  passPercent: z.number().int().min(1).max(100),
  timeLimitMin: z.number().int().min(1).max(600).nullable(),
  maxAttempts: z.number().int().min(1).max(20),
});

const question = z
  .object({
    type: z.enum(['MCQ', 'ESSAY']),
    text: z.string().trim().min(1).max(5000),
    points: z.number().int().min(1).max(100).default(1),
    options: z.array(z.object({ text: z.string().trim().min(1).max(1000), isCorrect: z.boolean() })).max(10).default([]),
  })
  .superRefine((q, ctx) => {
    if (q.type === 'MCQ') {
      if (q.options.length < 2) ctx.addIssue({ code: 'custom', message: 'A choice question needs at least 2 options' });
      if (q.options.filter((o) => o.isCorrect).length !== 1) ctx.addIssue({ code: 'custom', message: 'Mark exactly one correct option' });
    }
  });

const quizView = (courseId: string) =>
  prisma.quiz.findUnique({ where: { courseId }, include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } });

quizAdminRouter.get(
  '/courses/:id/quiz',
  h(async (req, res) => {
    await assertQuizAccess(req.user, req.params.id);
    res.json(await quizView(req.params.id));
  }),
);

quizAdminRouter.put(
  '/courses/:id/quiz',
  h(async (req, res) => {
    await assertQuizAccess(req.user, req.params.id);
    const input = body(req, settings);
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) throw new AppError('NOT_FOUND', 404);
    const q = await prisma.quiz.upsert({ where: { courseId: course.id }, create: { courseId: course.id, ...input }, update: input });
    await writeAudit(req.user!.id, 'quiz.update', 'Quiz', q.id, input);
    res.json(await quizView(course.id));
  }),
);

quizAdminRouter.post(
  '/quiz/:quizId/questions',
  h(async (req, res) => {
    const quiz = await courseOfQuiz(req.params.quizId);
    await assertQuizAccess(req.user, quiz.courseId);
    const input = body(req, question);
    const last = await prisma.question.findFirst({ where: { quizId: quiz.id }, orderBy: { order: 'desc' } });
    const q = await prisma.question.create({
      data: {
        quizId: quiz.id,
        order: (last?.order ?? 0) + 1,
        type: input.type,
        text: input.text,
        points: input.points,
        options: input.type === 'MCQ' ? { create: input.options } : undefined,
      },
      include: { options: true },
    });
    await writeAudit(req.user!.id, 'question.create', 'Question', q.id, input);
    res.status(201).json(q);
  }),
);

quizAdminRouter.patch(
  '/questions/:id',
  h(async (req, res) => {
    const existing = await questionWithCourse(req.params.id);
    await assertQuizAccess(req.user, existing.quiz.courseId);
    const input = body(req, question);
    const q = await prisma.$transaction(async (tx) => {
      await tx.option.deleteMany({ where: { questionId: existing.id } });
      const updated = await tx.question.update({
        where: { id: existing.id },
        data: { type: input.type, text: input.text, points: input.points, options: input.type === 'MCQ' ? { create: input.options } : undefined },
        include: { options: true },
      });
      await writeAudit(req.user!.id, 'question.update', 'Question', existing.id, input, tx);
      return updated;
    });
    res.json(q);
  }),
);

quizAdminRouter.delete(
  '/questions/:id',
  h(async (req, res) => {
    const q = await questionWithCourse(req.params.id);
    await assertQuizAccess(req.user, q.quiz.courseId);
    await prisma.$transaction(async (tx) => {
      await tx.question.delete({ where: { id: q.id } });
      const rest = await tx.question.findMany({ where: { quizId: q.quizId }, orderBy: { order: 'asc' } });
      for (let i = 0; i < rest.length; i++) await tx.question.update({ where: { id: rest[i].id }, data: { order: i + 1 } });
      await writeAudit(req.user!.id, 'question.delete', 'Question', q.id, { text: q.text }, tx);
    });
    res.json({ ok: true });
  }),
);

quizAdminRouter.put(
  '/quiz/:quizId/questions/order',
  h(async (req, res) => {
    const quiz = await courseOfQuiz(req.params.quizId);
    await assertQuizAccess(req.user, quiz.courseId);
    const { ids } = body(req, z.object({ ids: z.array(z.string()).min(1) }));
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) await tx.question.updateMany({ where: { id: ids[i], quizId: req.params.quizId }, data: { order: i + 1 } });
      await writeAudit(req.user!.id, 'question.reorder', 'Quiz', req.params.quizId, { ids }, tx);
    });
    res.json({ ok: true });
  }),
);
