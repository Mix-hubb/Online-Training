// Review moderation (spec 17).
//   GET    /admin/reviews?courseId&status&rating&q&page   newest first, with course + learner
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
