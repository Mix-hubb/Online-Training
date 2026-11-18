// Revenue-share partners per course. Changes only affect FUTURE orders (entries keep their snapshot).
//   GET /admin/courses/:id/revenue-shares
//   PUT /admin/courses/:id/revenue-shares  { shares: [{ partnerId, percentBp }] }  (sum <= 10000)
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';

export const revenueSharesAdminRouter = Router();

export function checkShares(shares: { partnerId: string; percentBp: number }[]) {
  const ids = new Set(shares.map((s) => s.partnerId));
  if (ids.size !== shares.length) throw new AppError('VALIDATION_FAILED', 400, 'Each partner can appear once');
  const total = shares.reduce((s, x) => s + x.percentBp, 0);
  if (total > 10000) throw new AppError('VALIDATION_FAILED', 400, `Shares add up to ${(total / 100).toFixed(2)}%, the maximum is 100%`);
}

const list = (courseId: string) =>
  prisma.courseRevenueShare.findMany({ where: { courseId }, include: { partner: { select: { id: true, name: true, userId: true } } } });

revenueSharesAdminRouter.get('/courses/:id/revenue-shares', h(async (req, res) => res.json(await list(req.params.id))));

revenueSharesAdminRouter.put(
  '/courses/:id/revenue-shares',
  h(async (req, res) => {
    const { shares } = body(req, z.object({ shares: z.array(z.object({ partnerId: z.string().min(1), percentBp: z.number().int().min(1).max(10000) })) }));
    checkShares(shares);
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) throw new AppError('NOT_FOUND', 404);
    await prisma.$transaction(async (tx) => {
      await tx.courseRevenueShare.deleteMany({ where: { courseId: course.id } });
      if (shares.length) await tx.courseRevenueShare.createMany({ data: shares.map((s) => ({ ...s, courseId: course.id })) });
      await writeAudit(req.user!.id, 'revenue_share.update', 'Course', course.id, { shares }, tx);
    });
    res.json(await list(course.id));
  }),
);
