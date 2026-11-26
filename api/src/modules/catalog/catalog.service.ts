// Catalog queries. Never returns video IDs or correct answers.
import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { paged } from '../../lib/pagination.js';
import type { CourseListQuery } from './catalog.schemas.js';
import { availableMethods } from '../payments/checkout-methods.js';
import { ratingSummary } from '../reviews/reviews.service.js';

export const cardInclude = {
  category: { select: { id: true, name: true, slug: true } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  lessons: { select: { durationSec: true } },
  instructors: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
} satisfies Prisma.CourseInclude;

type CardCourse = Prisma.CourseGetPayload<{ include: typeof cardInclude }>;

export function courseCard(c: CardCourse) {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    summary: c.summary,
    thumbnailUrl: c.thumbnailUrl,
    level: c.level,
    status: c.status,
    isFree: c.isFree,
    priceMinor: c.priceMinor,
    currency: c.currency,
    priceThbMinor: c.priceThbMinor,
    category: c.category,
    tags: c.tags.map((t) => t.tag),
    lessonCount: c.lessons.length,
    durationSec: c.lessons.reduce((s, l) => s + l.durationSec, 0),
    instructors: c.instructors.map((i) => i.user),
  };
}

/** Learner-facing order: admin-pinned courses first (by pinOrder), then newest. No "pinned" flag is sent to learners. */
export const catalogOrder: Prisma.CourseOrderByWithRelationInput[] = [
  { pinOrder: { sort: 'asc', nulls: 'last' } },
  { publishedAt: 'desc' },
  { createdAt: 'desc' },
  { id: 'asc' },
];

export async function listCourses(q: CourseListQuery) {
  const where: Prisma.CourseWhereInput = { status: 'PUBLISHED' };
  if (q.q) {
    where.OR = [
      { title: { contains: q.q, mode: 'insensitive' } },
      { summary: { contains: q.q, mode: 'insensitive' } },
    ];
  }
  if (q.category) where.category = { slug: q.category };
  if (q.level) where.level = q.level;
  if (q.price) where.isFree = q.price === 'free';
  if (q.tag) where.tags = { some: { tag: { slug: q.tag } } };
  const [rows, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: cardInclude,
      orderBy: catalogOrder,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.course.count({ where }),
  ]);
  return paged(rows.map(courseCard), total, q);
}

export async function courseDetail(slug: string, viewer?: User) {
  // Everything is keyed by the slug, so it is fetched in one round of parallel queries (each DB round trip
  // costs the network latency to the DB). Nothing is returned before the visibility checks below.
  const [c, enrollment, rating, pending] = await Promise.all([
    prisma.course.findUnique({
      where: { slug },
      include: {
        ...cardInclude,
        lessons: { orderBy: { order: 'asc' }, select: { id: true, order: true, title: true, description: true, durationSec: true } },
        quiz: { include: { _count: { select: { questions: true } } } },
      },
    }),
    viewer ? prisma.enrollment.findFirst({ where: { userId: viewer.id, course: { slug } } }) : null,
    ratingSummary({ slug }),
    viewer
      ? prisma.order.findFirst({
          where: { userId: viewer.id, course: { slug }, status: { in: ['PENDING', 'AWAITING_SLIP'] } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, provider: true, method: true },
        })
      : null,
  ]);
  if (!c) throw new AppError('NOT_FOUND', 404);

  const isStaff = viewer?.role === 'ADMIN';

  // DRAFT: admins only. ARCHIVED: owners (and admins) only.
  if (c.status === 'DRAFT' && !isStaff) throw new AppError('NOT_FOUND', 404);
  if (c.status === 'ARCHIVED' && !isStaff && !enrollment) throw new AppError('COURSE_UNAVAILABLE', 410);


  return {
    ...courseCard({ ...c, lessons: c.lessons }),
    description: c.description,
    outcomes: c.outcomes,
    hasIntroVideo: Boolean(c.introVideoId),
    lessons: c.lessons,
    quiz: c.quiz
      ? {
          questionCount: c.quiz._count.questions,
          passPercent: c.quiz.passPercent,
          timeLimitMin: c.quiz.timeLimitMin,
          maxAttempts: c.quiz.maxAttempts,
        }
      : null,
    paymentMethods: c.isFree ? [] : availableMethods(c),
    rating: { average: rating.average, count: rating.count },
    viewer: viewer
      ? {
          enrolled: Boolean(enrollment),
          enrollmentStatus: enrollment?.status ?? null,
          lastLessonId: enrollment?.lastLessonId ?? null,
          pendingOrder: pending,
        }
      : null,
  };
}

export const listCategories = () => prisma.category.findMany({ orderBy: { name: 'asc' } });
export const listTags = () => prisma.tag.findMany({ orderBy: { name: 'asc' } });
