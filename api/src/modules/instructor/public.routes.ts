// Public instructor directory (2026-11-27). No sign-in needed. Only APPROVED instructors are listed.
//   GET /instructors?q&page          profile cards: name, avatar, headline, expertise, published course count
//   GET /instructors/:id             profile, the documents the instructor marked public (signed URLs),
//                                    PUBLISHED courses they own or co-teach
// Never returns email, phone, private documents or revenue share.
import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { paged } from '../../lib/pagination.js';
import { cardInclude, catalogOrder, courseCard } from '../catalog/catalog.service.js';
import { docView } from './profile.service.js';

export const publicInstructorsRouter = Router();

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
});

const publishedTaught = (userId?: string): Prisma.CourseWhereInput => ({
  status: 'PUBLISHED',
  instructors: userId ? { some: { userId } } : undefined,
});

publicInstructorsRouter.get(
  '/instructors',
  h(async (req, res) => {
    const q = listQuery.parse(req.query);
    const where: Prisma.UserWhereInput = {
      role: 'INSTRUCTOR',
      status: 'ACTIVE',
      instructorProfile: { status: 'APPROVED' },
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' } },
              { instructorProfile: { headline: { contains: q.q, mode: 'insensitive' } } },
              { instructorProfile: { expertise: { has: q.q } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          instructorProfile: { select: { headline: true, expertise: true } },
          _count: { select: { teaches: { where: { course: { status: 'PUBLISHED' } } } } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    res.json(
      paged(
        rows.map((u) => ({
          id: u.id,
          name: u.name,
          avatarUrl: u.avatarUrl,
          headline: u.instructorProfile?.headline ?? null,
          expertise: u.instructorProfile?.expertise ?? [],
          courseCount: u._count.teaches,
        })),
        total,
        q,
      ),
    );
  }),
);

publicInstructorsRouter.get(
  '/instructors/:id',
  h(async (req, res) => {
    const u = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'INSTRUCTOR', status: 'ACTIVE', instructorProfile: { status: 'APPROVED' } },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        instructorProfile: {
          include: { documents: { where: { isPublic: true }, orderBy: { createdAt: 'asc' } } },
        },
      },
    });
    if (!u || !u.instructorProfile) throw new AppError('NOT_FOUND', 404);
    const courses = await prisma.course.findMany({ where: publishedTaught(u.id), include: cardInclude, orderBy: catalogOrder });
    const p = u.instructorProfile;
    res.json({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      headline: p.headline,
      bio: p.bio,
      expertise: p.expertise,
      approvedAt: p.reviewedAt,
      documents: (await Promise.all(p.documents.map(docView))).map(({ isPublic: _p, sizeBytes: _s, ...d }) => d),
      courses: courses.map(courseCard),
    });
  }),
);
