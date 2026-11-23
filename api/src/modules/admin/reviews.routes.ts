// Review moderation (spec 17).
//   GET    /admin/reviews?courseId&status&rating&q&page   newest first, with course + learner
//   GET    /admin/reviews/stats?courseId   average + star distribution of SHOWN reviews (what learners see),
//          hidden count, last 30 days, and per course (all courses only)
//   PATCH  /admin/reviews/:id  { status: VISIBLE|HIDDEN, reason? }   hide or show again
//   DELETE /admin/reviews/:id
// Every mutation writes an audit row (review.hide / review.show / review.delete).
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { body, query } from '../../lib/validate.js';
import { paged, parsePage } from '../../lib/pagination.js';
import { writeAudit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';

export const reviewsAdminRouter = Router();

const include = {
  course: { select: { id: true, title: true, slug: true } },
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.CourseReviewInclude;

reviewsAdminRouter.get(
  '/reviews',
  h(async (req, res) => {
    const q = query(
      req,
      z
        .object({
          courseId: z.string().optional(),
          status: z.enum(['VISIBLE', 'HIDDEN']).optional(),
          rating: z.coerce.number().int().min(1).max(5).optional(),
          q: z.string().trim().max(200).optional(),
        })
        .passthrough(),
    );
    const p = parsePage(req.query);
    const where: Prisma.CourseReviewWhereInput = {
      ...(q.courseId ? { courseId: q.courseId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.rating ? { rating: q.rating } : {}),
      ...(q.q
        ? {
            OR: [
              { body: { contains: q.q, mode: 'insensitive' } },
              { user: { name: { contains: q.q, mode: 'insensitive' } } },
              { user: { email: { contains: q.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total, hidden] = await Promise.all([
      prisma.courseReview.findMany({ where, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take, include }),
      prisma.courseReview.count({ where }),
      prisma.courseReview.count({ where: { ...where, status: 'HIDDEN' } }),
    ]);
    res.json({ ...paged(rows, total, p), hidden });
  }),
);

type Dist = Record<1 | 2 | 3 | 4 | 5, number>;
const emptyDist = (): Dist => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
const avg = (sum: number, count: number) => (count ? Math.round((sum / count) * 10) / 10 : null);

reviewsAdminRouter.get(
  '/reviews/stats',
  h(async (req, res) => {
    const q = query(req, z.object({ courseId: z.string().optional() }).passthrough());
    const scope: Prisma.CourseReviewWhereInput = q.courseId ? { courseId: q.courseId } : {};
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [groups, recent, perCourse] = await Promise.all([
      prisma.courseReview.groupBy({ by: ['status', 'rating'], where: scope, _count: { _all: true } }),
      prisma.courseReview.aggregate({ where: { ...scope, status: 'VISIBLE', createdAt: { gte: since } }, _count: { _all: true }, _avg: { rating: true } }),
      q.courseId ? Promise.resolve([]) : prisma.courseReview.groupBy({ by: ['courseId', 'status'], _count: { _all: true }, _sum: { rating: true } }),
    ]);
    const distribution = emptyDist();
    let count = 0;
    let sum = 0;
    let hidden = 0;
    for (const g of groups) {
      if (g.status === 'HIDDEN') {
        hidden += g._count._all;
        continue;
      }
      const r = g.rating as keyof Dist;
      if (!(r in distribution)) continue;
      distribution[r] += g._count._all;
      count += g._count._all;
      sum += r * g._count._all;
    }
    const byId = new Map<string, { count: number; sum: number; hidden: number }>();
    for (const g of perCourse) {
      const e = byId.get(g.courseId) ?? { count: 0, sum: 0, hidden: 0 };
      if (g.status === 'HIDDEN') e.hidden += g._count._all;
      else {
        e.count += g._count._all;
        e.sum += g._sum.rating ?? 0;
      }
      byId.set(g.courseId, e);
    }
    const titles = byId.size
      ? await prisma.course.findMany({ where: { id: { in: [...byId.keys()] } }, select: { id: true, title: true, slug: true } })
      : [];
    const byCourse = titles
      .map((c) => {
        const e = byId.get(c.id)!;
        return { courseId: c.id, title: c.title, slug: c.slug, average: avg(e.sum, e.count), count: e.count, hidden: e.hidden };
      })
      .sort((a, b) => b.count - a.count || (b.average ?? 0) - (a.average ?? 0) || a.title.localeCompare(b.title));
    res.json({
      average: avg(sum, count),
      count,
      distribution,
      hidden,
      last30Days: { count: recent._count._all, average: recent._avg.rating === null ? null : Math.round(recent._avg.rating * 10) / 10 },
      byCourse,
    });
  }),
);

reviewsAdminRouter.patch(
  '/reviews/:id',
  h(async (req, res) => {
    const input = body(req, z.object({ status: z.enum(['VISIBLE', 'HIDDEN']), reason: z.string().trim().max(500).optional() }));
    const before = await prisma.courseReview.findUnique({ where: { id: req.params.id } });
    if (!before) throw new AppError('NOT_FOUND', 404);
    const hiddenReason = input.status === 'HIDDEN' ? input.reason || null : null;
    const r = await prisma.$transaction(async (tx) => {
      // Keep updatedAt: moderation is not a learner edit (the public list shows "edited" from it).
      const updated = await tx.courseReview.update({ where: { id: before.id }, data: { status: input.status, hiddenReason, updatedAt: before.updatedAt }, include });
      await writeAudit(
        req.user!.id,
        input.status === 'HIDDEN' ? 'review.hide' : 'review.show',
        'CourseReview',
        before.id,
        { courseId: before.courseId, from: before.status, to: input.status, reason: hiddenReason },
        tx,
      );
      return updated;
    });
    res.json(r);
  }),
);

reviewsAdminRouter.delete(
  '/reviews/:id',
  h(async (req, res) => {
    const before = await prisma.courseReview.findUnique({ where: { id: req.params.id } });
    if (!before) throw new AppError('NOT_FOUND', 404);
    await prisma.$transaction(async (tx) => {
      await tx.courseReview.delete({ where: { id: before.id } });
      await writeAudit(req.user!.id, 'review.delete', 'CourseReview', before.id, {
        courseId: before.courseId,
        userId: before.userId,
        rating: before.rating,
        body: before.body,
      }, tx);
    });
    res.status(204).end();
  }),
);
