// Course reviews (spec 17). A learner may review a course once its enrollment is COMPLETED;
// one review per learner per course, editable later. Admin-hidden reviews stay hidden on edit.
import { isHidden } from '../courses/access.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';

/** "Somchai Jaidee" -> "Somchai J." (public lists never show full names or emails). */
export function publicName(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Learner';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** Average (1 decimal), count and 1..5 distribution of VISIBLE reviews. */
/** By course id, or by slug (so a caller can fetch it together with the course itself). */
export async function ratingSummary(course: string | { slug: string }) {
  const groups = await prisma.courseReview.groupBy({
    by: ['rating'],
    where: typeof course === 'string' ? { courseId: course, status: 'VISIBLE' } : { course: { slug: course.slug }, status: 'VISIBLE' },
    _count: { _all: true },
  });
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let sum = 0;
  for (const g of groups) {
    const r = g.rating as 1 | 2 | 3 | 4 | 5;
    if (!(r in distribution)) continue;
    distribution[r] = g._count._all;
    count += g._count._all;
    sum += r * g._count._all;
  }
  return { average: count ? Math.round((sum / count) * 10) / 10 : null, count, distribution };
}

async function visibleCourse(slug: string) {
  const c = await prisma.course.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!c || isHidden(c.status)) throw new AppError('NOT_FOUND', 404);
  return c;
}

export async function listPublic(slug: string, p: { skip: number; take: number; page: number; pageSize: number }) {
  const c = await visibleCourse(slug);
  const where: Prisma.CourseReviewWhereInput = { courseId: c.id, status: 'VISIBLE' };
  const [rows, total, summary] = await Promise.all([
    prisma.courseReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: p.skip,
      take: p.take,
      select: { id: true, rating: true, body: true, createdAt: true, updatedAt: true, user: { select: { name: true } } },
    }),
    prisma.courseReview.count({ where }),
    ratingSummary(c.id),
  ]);
  return {
    summary,
    items: rows.map((r) => ({ id: r.id, rating: r.rating, body: r.body, createdAt: r.createdAt, edited: r.updatedAt.getTime() - r.createdAt.getTime() > 1000, author: publicName(r.user.name) })),
    total,
    page: p.page,
    pageSize: p.pageSize,
    pages: Math.max(1, Math.ceil(total / p.pageSize)),
  };
}

/** What the signed-in learner may do for this course, plus their own review (any status). */
export async function myReview(userId: string, courseId: string) {
  const [enrollment, review] = await Promise.all([
    prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { status: true } }),
    prisma.courseReview.findUnique({
      where: { courseId_userId: { courseId, userId } },
      select: { id: true, rating: true, body: true, status: true, createdAt: true, updatedAt: true },
    }),
  ]);
  // Once written, the review stays editable even if the learner later restarts the course.
  return { canReview: enrollment?.status === 'COMPLETED' || Boolean(review), review };
}

export async function upsertMine(userId: string, courseId: string, input: { rating: number; body: string }) {
  const { canReview } = await myReview(userId, courseId);
  if (!canReview) {
    const exists = await prisma.course.count({ where: { id: courseId } });
    if (!exists) throw new AppError('NOT_FOUND', 404);
    throw new AppError('NOT_COMPLETED', 403);
  }
  return prisma.courseReview.upsert({
    where: { courseId_userId: { courseId, userId } },
    create: { courseId, userId, rating: input.rating, body: input.body },
    update: { rating: input.rating, body: input.body }, // status untouched: a hidden review stays hidden
    select: { id: true, rating: true, body: true, status: true, createdAt: true, updatedAt: true },
  });
}

export async function deleteMine(userId: string, courseId: string) {
  await prisma.courseReview.deleteMany({ where: { courseId, userId } });
}
