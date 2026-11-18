// Assign instructors to a course (max 2, spec 15.2). A user becomes INSTRUCTOR by an admin action.
//   GET    /admin/courses/:id/instructors
//   POST   /admin/courses/:id/instructors  { userId }  (INSTRUCTOR_LIMIT when 2 already)
//   DELETE /admin/courses/:id/instructors/:userId
//   POST   /admin/users/:id/make-instructor
//   POST   /admin/users/:id/remove-instructor   (only when no course assignments are left)
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';

export const instructorsAdminRouter = Router();
export const MAX_INSTRUCTORS = 2;

const list = (courseId: string) =>
  prisma.courseInstructor.findMany({ where: { courseId }, include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } });

instructorsAdminRouter.get('/courses/:id/instructors', h(async (req, res) => res.json(await list(req.params.id))));

instructorsAdminRouter.post(
  '/courses/:id/instructors',
  h(async (req, res) => {
    const { userId } = body(req, z.object({ userId: z.string().min(1) }));
    const courseId = req.params.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 404);
    if (user.role !== 'INSTRUCTOR') throw new AppError('VALIDATION_FAILED', 400, 'Make this user an instructor first');
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${courseId}))`;
      const existing = await tx.courseInstructor.findMany({ where: { courseId } });
      if (existing.some((e) => e.userId === userId)) return;
      if (existing.length >= MAX_INSTRUCTORS) throw new AppError('INSTRUCTOR_LIMIT', 409, `A course can have at most ${MAX_INSTRUCTORS} instructors`);
      await tx.courseInstructor.create({ data: { courseId, userId, assignedBy: req.user!.id } });
      await writeAudit(req.user!.id, 'instructor.assign', 'Course', courseId, { userId }, tx);
    });
    res.status(201).json(await list(courseId));
  }),
);

instructorsAdminRouter.delete(
  '/courses/:id/instructors/:userId',
  h(async (req, res) => {
    await prisma.courseInstructor.deleteMany({ where: { courseId: req.params.id, userId: req.params.userId } });
    await writeAudit(req.user!.id, 'instructor.unassign', 'Course', req.params.id, { userId: req.params.userId });
    res.json(await list(req.params.id));
  }),
);

instructorsAdminRouter.post(
  '/users/:id/make-instructor',
  h(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u) throw new AppError('NOT_FOUND', 404);
    if (u.role !== 'USER') throw new AppError('VALIDATION_FAILED', 400, `This user is ${u.role}`);
    await prisma.user.update({ where: { id: u.id }, data: { role: 'INSTRUCTOR' } });
    await writeAudit(req.user!.id, 'user.make_instructor', 'User', u.id, { email: u.email });
    res.json({ ok: true });
  }),
);

instructorsAdminRouter.post(
  '/users/:id/remove-instructor',
  h(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.params.id }, include: { _count: { select: { teaches: true } } } });
    if (!u) throw new AppError('NOT_FOUND', 404);
    if (u.role !== 'INSTRUCTOR') throw new AppError('VALIDATION_FAILED', 400, 'This user is not an instructor');
    if (u._count.teaches > 0) throw new AppError('VALIDATION_FAILED', 409, 'Remove the course assignments first');
    await prisma.user.update({ where: { id: u.id }, data: { role: 'USER' } });
    await writeAudit(req.user!.id, 'user.remove_instructor', 'User', u.id, { email: u.email });
    res.json({ ok: true });
  }),
);
