// Assign instructors to a course (max 2, spec 15.2). A user becomes INSTRUCTOR by an admin action.
//   GET    /admin/courses/:id/instructors
//   POST   /admin/courses/:id/instructors  { userId, sharePercentBp? }  (INSTRUCTOR_LIMIT when 2 already)
//   PATCH  /admin/courses/:id/instructors/:userId  { sharePercentBp }
//          sharePercentBp = the instructor's share of THIS course's sales (basis points), taken before partners.
//          The course's instructors together <= 100%. A new percent only applies to orders paid after the change.
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
import { ensureInstructorPartner, MAX_TOTAL_SHARE_BP } from '../revenue/ledger.service.js';
import type { Tx } from '../../db.js';

export const instructorsAdminRouter = Router();
export const MAX_INSTRUCTORS = 2;

const list = (courseId: string) =>
  prisma.courseInstructor.findMany({ where: { courseId }, include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } });

const share = z.number().int().min(0).max(MAX_TOTAL_SHARE_BP);

/** The course's instructors together may not take more than 100% of a sale. Call under the course lock. */
async function checkCourseShare(tx: Tx, courseId: string, userId: string, sharePercentBp: number) {
  const others = await tx.courseInstructor.aggregate({ where: { courseId, userId: { not: userId } }, _sum: { sharePercentBp: true } });
  const total = (others._sum.sharePercentBp ?? 0) + sharePercentBp;
  if (total > MAX_TOTAL_SHARE_BP) {
    throw new AppError('VALIDATION_FAILED', 400, `Instructor shares for this course add up to ${(total / 100).toFixed(2)}%, the maximum is 100%`);
  }
}

instructorsAdminRouter.get('/courses/:id/instructors', h(async (req, res) => res.json(await list(req.params.id))));

instructorsAdminRouter.post(
  '/courses/:id/instructors',
  h(async (req, res) => {
    const { userId, sharePercentBp = 0 } = body(req, z.object({ userId: z.string().min(1), sharePercentBp: share.optional() }));
    const courseId = req.params.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 404);
    if (user.role !== 'INSTRUCTOR') throw new AppError('VALIDATION_FAILED', 400, 'Make this user an instructor first');
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${courseId}))`;
      const existing = await tx.courseInstructor.findMany({ where: { courseId } });
      if (existing.some((e) => e.userId === userId)) return;
      if (existing.length >= MAX_INSTRUCTORS) throw new AppError('INSTRUCTOR_LIMIT', 409, `A course can have at most ${MAX_INSTRUCTORS} instructors`);
      await checkCourseShare(tx, courseId, userId, sharePercentBp);
      await tx.courseInstructor.create({ data: { courseId, userId, assignedBy: req.user!.id, sharePercentBp } });
      // So the instructor's earnings page is linked from the start.
      if (sharePercentBp > 0) await ensureInstructorPartner(tx, user);
      await writeAudit(req.user!.id, 'instructor.assign', 'Course', courseId, { userId, sharePercentBp }, tx);
    });
    res.status(201).json(await list(courseId));
  }),
);

instructorsAdminRouter.patch(
  '/courses/:id/instructors/:userId',
  h(async (req, res) => {
    const { sharePercentBp } = body(req, z.object({ sharePercentBp: share }));
    const { id: courseId, userId } = req.params;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${courseId}))`;
      const row = await tx.courseInstructor.findUnique({ where: { courseId_userId: { courseId, userId } }, include: { user: true } });
      if (!row) throw new AppError('NOT_FOUND', 404, 'This instructor is not assigned to the course');
      await checkCourseShare(tx, courseId, userId, sharePercentBp);
      await tx.courseInstructor.update({ where: { courseId_userId: { courseId, userId } }, data: { sharePercentBp } });
      if (sharePercentBp > 0) await ensureInstructorPartner(tx, row.user);
      await writeAudit(req.user!.id, 'instructor.share', 'Course', courseId, { userId, from: row.sharePercentBp, to: sharePercentBp }, tx);
    });
    res.json(await list(courseId));
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
