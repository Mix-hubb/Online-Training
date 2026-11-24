// Assign instructors to a course (max 2, spec 15.2). A user becomes INSTRUCTOR by an admin action.
//   GET    /admin/courses/:id/instructors
//   POST   /admin/courses/:id/instructors  { userId, sharePercentBp? }  (INSTRUCTOR_LIMIT when 2 already)
//   PATCH  /admin/courses/:id/instructors/:userId  { sharePercentBp }
//          sharePercentBp = the instructor's share of THIS course's sales (basis points), taken before partners.
//          The course's instructors together <= 100%. A new percent only applies to orders paid after the change.
//   DELETE /admin/courses/:id/instructors/:userId
//   POST   /admin/users/:id/make-instructor
//   POST   /admin/users/:id/remove-instructor   (only when no course assignments are left)
// Instructor accounts (2026-11-23, admin "Instructors" page):
//   GET    /admin/instructors?q&status&page     instructors with their courses, shares and unpaid balance
//   POST   /admin/instructors  { name, email, promoteExisting? }
//          new email -> INSTRUCTOR login, temporary password returned ONCE (never stored in plain text)
//          email of a learner -> ACCOUNT_EXISTS (409); resend with promoteExisting: true to make them an instructor
//   GET    /admin/instructors/:id   one instructor: profile, assigned courses (share, co-instructors, learners,
//          rating, earned per course), earnings totals per currency and the latest revenue entries (2026-11-24)
//   POST   /admin/instructors/:id/reset-password   FALLBACK only ("Forgot password?" first); temporary password once
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { paged, parsePage } from '../../lib/pagination.js';
import { tempPassword } from '../../lib/tokens.js';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body, email, query } from '../../lib/validate.js';
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

// ---- Instructor accounts ----

instructorsAdminRouter.get(
  '/instructors',
  h(async (req, res) => {
    const q = query(req, z.object({ q: z.string().trim().max(200).optional(), status: z.enum(['ACTIVE', 'BANNED']).optional() }).passthrough());
    const p = parsePage(req.query);
    const where: Prisma.UserWhereInput = {
      role: 'INSTRUCTOR',
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { name: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: p.skip,
        take: p.take,
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          status: true,
          mustChangePassword: true,
          createdAt: true,
          teaches: { select: { sharePercentBp: true, course: { select: { id: true, title: true, slug: true, status: true } } }, orderBy: { course: { title: 'asc' } } },
          partnerLink: { select: { id: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    const partnerIds = users.map((u) => u.partnerLink?.id).filter((x): x is string => !!x);
    const unpaid = partnerIds.length
      ? await prisma.revenueEntry.groupBy({ by: ['partnerId', 'currency'], where: { status: 'UNPAID', partnerId: { in: partnerIds } }, _sum: { amountMinor: true } })
      : [];
    const items = users.map(({ partnerLink, teaches, ...u }) => ({
      ...u,
      partnerId: partnerLink?.id ?? null,
      courses: teaches.map((t) => ({ ...t.course, sharePercentBp: t.sharePercentBp })),
      outstanding: unpaid.filter((x) => x.partnerId === partnerLink?.id).map((x) => ({ currency: x.currency, amountMinor: x._sum.amountMinor ?? 0 })),
    }));
    res.json(paged(items, total, p));
  }),
);

const RECENT_ENTRIES = 10;

instructorsAdminRouter.get(
  '/instructors/:id',
  h(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        status: true,
        mustChangePassword: true,
        createdAt: true,
        partnerLink: { select: { id: true } },
        teaches: {
          orderBy: { course: { title: 'asc' } },
          select: {
            sharePercentBp: true,
            assignedAt: true,
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                thumbnailUrl: true,
                isFree: true,
                priceMinor: true,
                priceThbMinor: true,
                instructors: { select: { sharePercentBp: true, user: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
    });
    if (!u || u.role !== 'INSTRUCTOR') throw new AppError('NOT_FOUND', 404);
    const courseIds = u.teaches.map((t) => t.course.id);
    const partnerId = u.partnerLink?.id ?? null;
    const [learners, completed, ratings, earnedByCourse, totals, recent] = await Promise.all([
      prisma.enrollment.groupBy({ by: ['courseId'], where: { courseId: { in: courseIds } }, _count: { _all: true } }),
      prisma.enrollment.groupBy({ by: ['courseId'], where: { courseId: { in: courseIds }, status: 'COMPLETED' }, _count: { _all: true } }),
      prisma.courseReview.groupBy({ by: ['courseId'], where: { courseId: { in: courseIds }, status: 'VISIBLE' }, _avg: { rating: true }, _count: { _all: true } }),
      partnerId
        ? prisma.revenueEntry.groupBy({ by: ['courseId', 'currency'], where: { partnerId }, _sum: { amountMinor: true } })
        : Promise.resolve([]),
      partnerId
        ? prisma.revenueEntry.groupBy({ by: ['currency', 'status'], where: { partnerId }, _sum: { amountMinor: true } })
        : Promise.resolve([]),
      partnerId
        ? prisma.revenueEntry.findMany({ where: { partnerId }, orderBy: { createdAt: 'desc' }, take: RECENT_ENTRIES })
        : Promise.resolve([]),
    ]);
    const titles = new Map(u.teaches.map((t) => [t.course.id, t.course.title]));
    // Entries can belong to a course the instructor no longer teaches.
    const missing = [...new Set(recent.map((e) => e.courseId).filter((id) => !titles.has(id)))];
    if (missing.length) {
      for (const c of await prisma.course.findMany({ where: { id: { in: missing } }, select: { id: true, title: true } })) titles.set(c.id, c.title);
    }
    const currencies = [...new Set(totals.map((t) => t.currency))].sort();
    const sumOf = (currency: string, status?: 'PAID' | 'UNPAID') =>
      totals.filter((t) => t.currency === currency && (!status || t.status === status)).reduce((a, t) => a + (t._sum.amountMinor ?? 0), 0);

    res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      status: u.status,
      mustChangePassword: u.mustChangePassword,
      createdAt: u.createdAt,
      partnerId,
      courses: u.teaches.map(({ course: { instructors, ...c }, sharePercentBp, assignedAt }) => {
        const r = ratings.find((x) => x.courseId === c.id);
        return {
          ...c,
          sharePercentBp,
          assignedAt,
          coInstructors: instructors.filter((i) => i.user.id !== u.id).map((i) => ({ id: i.user.id, name: i.user.name, sharePercentBp: i.sharePercentBp })),
          learners: learners.find((x) => x.courseId === c.id)?._count._all ?? 0,
          completed: completed.find((x) => x.courseId === c.id)?._count._all ?? 0,
          rating: { average: r?._avg.rating ?? null, count: r?._count._all ?? 0 },
          earned: earnedByCourse.filter((x) => x.courseId === c.id).map((x) => ({ currency: x.currency, amountMinor: x._sum.amountMinor ?? 0 })),
        };
      }),
      earnings: currencies.map((currency) => ({
        currency,
        earnedMinor: sumOf(currency),
        paidMinor: sumOf(currency, 'PAID'),
        unpaidMinor: sumOf(currency, 'UNPAID'),
      })),
      recent: recent.map((e) => ({
        id: e.id,
        createdAt: e.createdAt,
        courseId: e.courseId,
        courseTitle: titles.get(e.courseId) ?? 'Deleted course',
        currency: e.currency,
        baseMinor: e.baseMinor,
        percentBp: e.percentBp,
        amountMinor: e.amountMinor,
        status: e.status,
      })),
    });
  }),
);

instructorsAdminRouter.post(
  '/instructors',
  h(async (req, res) => {
    const input = body(req, z.object({ name: z.string().trim().min(1).max(150), email, promoteExisting: z.boolean().optional() }));
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      if (existing.role === 'INSTRUCTOR') throw new AppError('VALIDATION_FAILED', 409, 'This person is already an instructor');
      if (existing.role !== 'USER') throw new AppError('VALIDATION_FAILED', 409, `This email belongs to a ${existing.role.toLowerCase()} account`);
      if (!input.promoteExisting) throw new AppError('ACCOUNT_EXISTS', 409, `${existing.name} already has a learner account with this email`);
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'INSTRUCTOR' } });
      await writeAudit(req.user!.id, 'user.make_instructor', 'User', existing.id, { email: existing.email });
      return void res.json({ id: existing.id, email: existing.email, promoted: true, temporaryPassword: null });
    }
    const password = tempPassword();
    const u = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          role: 'INSTRUCTOR',
          passwordHash: await bcrypt.hash(password, 10),
          emailVerifiedAt: new Date(),
          mustChangePassword: true,
        },
      });
      // Never put the password in the audit log.
      await writeAudit(req.user!.id, 'instructor.account_create', 'User', created.id, { email: created.email, name: created.name }, tx);
      return created;
    });
    res.status(201).json({ id: u.id, email: u.email, promoted: false, temporaryPassword: password });
  }),
);

instructorsAdminRouter.post(
  '/instructors/:id/reset-password',
  h(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u || u.role !== 'INSTRUCTOR') throw new AppError('NOT_FOUND', 404);
    const password = tempPassword();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true } });
      await tx.authToken.updateMany({ where: { userId: u.id, type: 'RESET', usedAt: null }, data: { usedAt: new Date() } });
      await writeAudit(req.user!.id, 'instructor.password_reset', 'User', u.id, { email: u.email }, tx);
    });
    res.json({ email: u.email, temporaryPassword: password });
  }),
);
