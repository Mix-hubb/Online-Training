// Users. Role changes only through the instructor / partner actions.
//   GET  /admin/users?q&status&role&page
//   GET  /admin/users/:id        (enrollments, orders)
//   POST /admin/users/:id/ban
//   POST /admin/users/:id/unban
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { query } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { paged, parsePage } from '../../lib/pagination.js';
import { myCourses } from '../learning/enrollment.service.js';

export const usersAdminRouter = Router();

const publicUser = { id: true, email: true, name: true, avatarUrl: true, role: true, status: true, emailVerifiedAt: true, createdAt: true } as const;

usersAdminRouter.get(
  '/users',
  h(async (req, res) => {
    const q = query(
      req,
      z
        .object({
          q: z.string().optional(),
          status: z.enum(['ACTIVE', 'BANNED']).optional(),
          role: z.enum(['USER', 'INSTRUCTOR', 'PARTNER', 'ADMIN']).optional(),
        })
        .passthrough(),
    );
    const p = parsePage(req.query);
    const where: Prisma.UserWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.role ? { role: q.role } : {}),
      ...(q.q ? { OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { name: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take, select: { ...publicUser, _count: { select: { enrollments: true } } } }),
      prisma.user.count({ where }),
    ]);
    res.json(paged(rows, total, p));
  }),
);

usersAdminRouter.get(
  '/users/:id',
  h(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: publicUser });
    if (!user) throw new AppError('NOT_FOUND', 404);
    const [courses, orders, partner] = await Promise.all([
      myCourses(user.id),
      prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, include: { course: { select: { title: true } } } }),
      prisma.partner.findUnique({ where: { userId: user.id }, select: { id: true, name: true } }),
    ]);
    res.json({ user, courses, orders, partner });
  }),
);

async function setStatus(adminId: string, id: string, status: 'ACTIVE' | 'BANNED') {
  if (id === adminId) throw new AppError('VALIDATION_FAILED', 400, 'You cannot ban yourself');
  const u = await prisma.user.update({ where: { id }, data: { status }, select: publicUser }).catch(() => {
    throw new AppError('NOT_FOUND', 404);
  });
  await writeAudit(adminId, status === 'BANNED' ? 'user.ban' : 'user.unban', 'User', id, { email: u.email });
  return u;
}

usersAdminRouter.post('/users/:id/ban', h(async (req, res) => res.json(await setStatus(req.user!.id, req.params.id, 'BANNED'))));
usersAdminRouter.post('/users/:id/unban', h(async (req, res) => res.json(await setStatus(req.user!.id, req.params.id, 'ACTIVE'))));
