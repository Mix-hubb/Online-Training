// Course CRUD.
//   GET    /admin/courses?q&status&category&page
//   POST   /admin/courses
//   GET    /admin/courses/:id
//   PATCH  /admin/courses/:id           (details: incl. priceThbMinor, allow4k)
//   POST   /admin/courses/:id/status    { status: DRAFT|PUBLISHED|ARCHIVED }
//   DELETE /admin/courses/:id           (blocked when orders exist: archive instead)
//   GET    /admin/courses/:id/learners
//   POST   /admin/courses/:id/intro-upload-init
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body, query } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { paged, parsePage } from '../../lib/pagination.js';
import { uniqueCourseSlug } from '../../lib/slug.js';
import { video } from '../../providers/video/index.js';
import { courseLearners } from '../learning/learners.service.js';

export const coursesAdminRouter = Router();

const money = z.number().int().min(0).max(100_000_000);

const courseFields = z.object({
  title: z.string().trim().min(1).max(150),
  summary: z.string().trim().max(300).default(''),
  description: z.string().max(20000).default(''),
  outcomes: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  thumbnailUrl: z.string().url().nullable().optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('BEGINNER'),
  categoryId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).max(20).optional(),
  isFree: z.boolean().default(true),
  priceMinor: money.default(0),
  priceThbMinor: money.nullable().optional(),
  allow4k: z.boolean().default(false),
  slug: z.string().trim().min(1).max(90).regex(/^[a-z0-9฀-๿-]+$/).optional(),
});

function checkPrice(c: { isFree?: boolean; priceMinor?: number; priceThbMinor?: number | null }) {
  if (c.isFree === false && !(c.priceMinor && c.priceMinor > 0) && !(c.priceThbMinor && c.priceThbMinor > 0)) {
    throw new AppError('VALIDATION_FAILED', 400, 'A paid course needs a USD or THB price');
  }
}

async function loadFull(id: string) {
  const c = await prisma.course.findUnique({
    where: { id },
    include: {
      category: true,
      tags: { include: { tag: true } },
      lessons: { orderBy: { order: 'asc' }, include: { renditions: true } },
      quiz: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } },
      instructors: { include: { user: { select: { id: true, name: true, email: true } } } },
      shares: { include: { partner: { select: { id: true, name: true } } } },
      _count: { select: { enrollments: true, orders: true } },
    },
  });
  if (!c) throw new AppError('NOT_FOUND', 404);
  return { ...c, tags: c.tags.map((t) => t.tag) };
}

coursesAdminRouter.get(
  '/courses',
  h(async (req, res) => {
    const q = query(req, z.object({ q: z.string().optional(), status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(), category: z.string().optional() }).passthrough());
    const p = parsePage(req.query);
    const where: Prisma.CourseWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.category ? { categoryId: q.category } : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.course.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: p.skip,
        take: p.take,
        include: { category: { select: { name: true } }, _count: { select: { lessons: true, enrollments: true } } },
      }),
      prisma.course.count({ where }),
    ]);
    res.json(
      paged(
        rows.map((c) => ({
          id: c.id,
          slug: c.slug,
          title: c.title,
          status: c.status,
          isFree: c.isFree,
          priceMinor: c.priceMinor,
          priceThbMinor: c.priceThbMinor,
          thumbnailUrl: c.thumbnailUrl,
          category: c.category?.name ?? null,
          lessons: c._count.lessons,
          learners: c._count.enrollments,
          updatedAt: c.updatedAt,
        })),
        total,
        p,
      ),
    );
  }),
);

coursesAdminRouter.post(
  '/courses',
  h(async (req, res) => {
    const input = body(req, courseFields);
    checkPrice(input);
    const { tagIds, slug, ...data } = input;
    const course = await prisma.course.create({
      data: {
        ...data,
        priceMinor: data.isFree ? 0 : data.priceMinor,
        priceThbMinor: data.isFree ? null : (data.priceThbMinor ?? null),
        slug: await uniqueCourseSlug(slug ?? data.title),
        tags: tagIds?.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
    });
    await writeAudit(req.user!.id, 'course.create', 'Course', course.id, input);
    res.status(201).json(await loadFull(course.id));
  }),
);

coursesAdminRouter.get('/courses/:id', h(async (req, res) => res.json(await loadFull(req.params.id))));

coursesAdminRouter.patch(
  '/courses/:id',
  h(async (req, res) => {
    const input = body(req, courseFields.partial());
    const before = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!before) throw new AppError('NOT_FOUND', 404);
    checkPrice({ ...before, ...input });
    const { tagIds, slug, ...data } = input;
    const isFree = data.isFree ?? before.isFree;
    await prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id: before.id },
        data: {
          ...data,
          ...(isFree ? { priceMinor: 0, priceThbMinor: null } : {}),
          ...(slug && slug !== before.slug ? { slug: await uniqueCourseSlug(slug, before.id) } : {}),
          ...(data.title && !slug && before.status === 'DRAFT' && data.title !== before.title
            ? { slug: await uniqueCourseSlug(data.title, before.id) }
            : {}),
        },
      });
      if (tagIds) {
        await tx.courseTag.deleteMany({ where: { courseId: before.id } });
        if (tagIds.length) await tx.courseTag.createMany({ data: tagIds.map((tagId) => ({ courseId: before.id, tagId })) });
      }
      await writeAudit(req.user!.id, 'course.update', 'Course', before.id, input, tx);
    });
    res.json(await loadFull(before.id));
  }),
);

coursesAdminRouter.post(
  '/courses/:id/status',
  h(async (req, res) => {
    const { status } = body(req, z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']) }));
    const c = await prisma.course.findUnique({ where: { id: req.params.id }, include: { lessons: true } });
    if (!c) throw new AppError('NOT_FOUND', 404);
    if (status === 'PUBLISHED') {
      if (!c.lessons.length) throw new AppError('VALIDATION_FAILED', 400, 'Add at least one lesson before publishing');
      if (!c.summary.trim()) throw new AppError('VALIDATION_FAILED', 400, 'Add a short summary before publishing');
    }
    await prisma.course.update({
      where: { id: c.id },
      data: { status, ...(status === 'PUBLISHED' && !c.publishedAt ? { publishedAt: new Date() } : {}) },
    });
    await writeAudit(req.user!.id, 'course.status', 'Course', c.id, { from: c.status, to: status });
    res.json(await loadFull(c.id));
  }),
);

coursesAdminRouter.delete(
  '/courses/:id',
  h(async (req, res) => {
    const c = await prisma.course.findUnique({ where: { id: req.params.id }, include: { _count: { select: { orders: true, enrollments: true } } } });
    if (!c) throw new AppError('NOT_FOUND', 404);
    if (c._count.orders > 0 || c._count.enrollments > 0) {
      throw new AppError('VALIDATION_FAILED', 409, 'This course has learners or orders. Archive it instead.');
    }
    await prisma.course.delete({ where: { id: c.id } });
    await writeAudit(req.user!.id, 'course.delete', 'Course', c.id, { title: c.title });
    res.json({ ok: true });
  }),
);

coursesAdminRouter.get('/courses/:id/learners', h(async (req, res) => res.json(await courseLearners(req.params.id))));

coursesAdminRouter.post(
  '/courses/:id/intro-upload-init',
  h(async (req, res) => {
    const c = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!c) throw new AppError('NOT_FOUND', 404);
    const v = await video.createVideo(`${c.title} - intro`);
    await prisma.course.update({ where: { id: c.id }, data: { introVideoId: v.providerVideoId } });
    await writeAudit(req.user!.id, 'course.intro_upload', 'Course', c.id);
    res.json(v);
  }),
);
