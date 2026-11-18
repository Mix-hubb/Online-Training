// Categories and tags CRUD.
//   GET/POST /admin/categories, PATCH/DELETE /admin/categories/:id
//   GET/POST /admin/tags,       PATCH/DELETE /admin/tags/:id
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { slugify } from '../../lib/slug.js';

export const taxonomyAdminRouter = Router();
const nameBody = z.object({ name: z.string().trim().min(1).max(60) });

function dup(e: unknown): never {
  if ((e as { code?: string }).code === 'P2002') throw new AppError('VALIDATION_FAILED', 409, 'That name is already used');
  if ((e as { code?: string }).code === 'P2025') throw new AppError('NOT_FOUND', 404);
  throw e;
}

taxonomyAdminRouter.get(
  '/categories',
  h(async (_req, res) =>
    res.json(await prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { courses: true } } } })),
  ),
);
taxonomyAdminRouter.post(
  '/categories',
  h(async (req, res) => {
    const { name } = body(req, nameBody);
    const c = await prisma.category.create({ data: { name, slug: slugify(name) } }).catch(dup);
    await writeAudit(req.user!.id, 'category.create', 'Category', c.id, { name });
    res.status(201).json(c);
  }),
);
taxonomyAdminRouter.patch(
  '/categories/:id',
  h(async (req, res) => {
    const { name } = body(req, nameBody);
    const c = await prisma.category.update({ where: { id: req.params.id }, data: { name, slug: slugify(name) } }).catch(dup);
    await writeAudit(req.user!.id, 'category.update', 'Category', c.id, { name });
    res.json(c);
  }),
);
taxonomyAdminRouter.delete(
  '/categories/:id',
  h(async (req, res) => {
    await prisma.category.delete({ where: { id: req.params.id } }).catch(dup);
    await writeAudit(req.user!.id, 'category.delete', 'Category', req.params.id);
    res.json({ ok: true });
  }),
);

taxonomyAdminRouter.get(
  '/tags',
  h(async (_req, res) => res.json(await prisma.tag.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { courses: true } } } }))),
);
taxonomyAdminRouter.post(
  '/tags',
  h(async (req, res) => {
    const { name } = body(req, nameBody);
    const t = await prisma.tag.create({ data: { name, slug: slugify(name) } }).catch(dup);
    await writeAudit(req.user!.id, 'tag.create', 'Tag', t.id, { name });
    res.status(201).json(t);
  }),
);
taxonomyAdminRouter.patch(
  '/tags/:id',
  h(async (req, res) => {
    const { name } = body(req, nameBody);
    const t = await prisma.tag.update({ where: { id: req.params.id }, data: { name, slug: slugify(name) } }).catch(dup);
    await writeAudit(req.user!.id, 'tag.update', 'Tag', t.id, { name });
    res.json(t);
  }),
);
taxonomyAdminRouter.delete(
  '/tags/:id',
  h(async (req, res) => {
    await prisma.tag.delete({ where: { id: req.params.id } }).catch(dup);
    await writeAudit(req.user!.id, 'tag.delete', 'Tag', req.params.id);
    res.json({ ok: true });
  }),
);
