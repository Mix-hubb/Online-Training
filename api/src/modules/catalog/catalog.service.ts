// Catalog queries. Never returns video IDs or correct answers.
import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { paged } from '../../lib/pagination.js';
import type { CourseListQuery } from './catalog.schemas.js';
import { availableMethods } from '../payments/checkout-methods.js';

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
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.course.count({ where }),
  ]);
  return paged(rows.map(courseCard), total, q);
}

export async function courseDetail(slug: string, viewer?: User) {
  const c = await prisma.course.findUnique({
    where: { slug },
    include: {
      ...cardInclude,
      lessons: { orderBy: { order: 'asc' }, select: { id: true, order: true, title: true, description: true, durationSec: true } },
      quiz: { include: { _count: { select: { questions: true } } } },
    },
  });
  if (!c) throw new AppError('NOT_FOUND', 404);

  const isStaff = viewer?.role === 'ADMIN';
  const enrollment = viewer
    ? await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: viewer.id, courseId: c.id } } })
    : null;

  // DRAFT: admins only. ARCHIVED: owners (and admins) only.
  if (c.status === 'DRAFT' && !isStaff) throw new AppError('NOT_FOUND', 404);
  if (c.status === 'ARCHIVED' && !isStaff && !enrollment) throw new AppError('COURSE_UNAVAILABLE', 410);

  const pinned = viewer
    ? Boolean(await prisma.userPin.findUnique({ where: { userId_courseId: { userId: viewer.id, courseId: c.id } } }))
    : false;
  const pending = viewer
    ? await prisma.order.findFirst({
        where: { userId: viewer.id, courseId: c.id, status: { in: ['PENDING', 'AWAITING_SLIP'] } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, provider: true, method: true },
      })
    : null;

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
    viewer: viewer
      ? {
          enrolled: Boolean(enrollment),
          enrollmentStatus: enrollment?.status ?? null,
          lastLessonId: enrollment?.lastLessonId ?? null,
          pinned,
          pendingOrder: pending,
        }
      : null,
  };
}

export const listCategories = () => prisma.category.findMany({ orderBy: { name: 'asc' } });
export const listTags = () => prisma.tag.findMany({ orderBy: { name: 'asc' } });
