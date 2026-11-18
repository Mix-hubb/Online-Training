// Landing CMS.
//   GET    /admin/banners
//   POST   /admin/banners            { imageUrl, linkUrl?, altText?, isActive? }
//   PATCH  /admin/banners/:id
//   DELETE /admin/banners/:id
//   PUT    /admin/banners/order      { ids }
//   GET    /admin/landing            (all sections, "bank" excluded)
//   PUT    /admin/landing            { sections: [{ key, content, isVisible, order }] }
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';

export const landingAdminRouter = Router();

const banner = z.object({
  imageUrl: z.string().url(),
  linkUrl: z.string().max(500).nullable().optional(),
  altText: z.string().max(200).nullable().optional(),
  isActive: z.boolean().default(true),
});

landingAdminRouter.get('/banners', h(async (_req, res) => res.json(await prisma.banner.findMany({ orderBy: { order: 'asc' } }))));

landingAdminRouter.post(
  '/banners',
  h(async (req, res) => {
    const input = body(req, banner);
    const last = await prisma.banner.findFirst({ orderBy: { order: 'desc' } });
    const b = await prisma.banner.create({ data: { ...input, order: (last?.order ?? 0) + 1 } });
    await writeAudit(req.user!.id, 'banner.create', 'Banner', b.id, input);
    res.status(201).json(b);
  }),
);

landingAdminRouter.put(
  '/banners/order',
  h(async (req, res) => {
    const { ids } = body(req, z.object({ ids: z.array(z.string()).min(1) }));
    await prisma.$transaction(ids.map((id, i) => prisma.banner.update({ where: { id }, data: { order: i + 1 } })));
    await writeAudit(req.user!.id, 'banner.reorder', 'Banner', null, { ids });
    res.json(await prisma.banner.findMany({ orderBy: { order: 'asc' } }));
  }),
);

landingAdminRouter.patch(
  '/banners/:id',
  h(async (req, res) => {
    const input = body(req, banner.partial());
    const b = await prisma.banner.update({ where: { id: req.params.id }, data: input }).catch(() => {
      throw new AppError('NOT_FOUND', 404);
    });
    await writeAudit(req.user!.id, 'banner.update', 'Banner', b.id, input);
    res.json(b);
  }),
);

landingAdminRouter.delete(
  '/banners/:id',
  h(async (req, res) => {
    await prisma.banner.delete({ where: { id: req.params.id } }).catch(() => {
      throw new AppError('NOT_FOUND', 404);
    });
    await writeAudit(req.user!.id, 'banner.delete', 'Banner', req.params.id);
    res.json({ ok: true });
  }),
);

landingAdminRouter.get(
  '/landing',
  h(async (_req, res) => res.json(await prisma.landingSection.findMany({ where: { key: { not: 'bank' } }, orderBy: { order: 'asc' } }))),
);

landingAdminRouter.put(
  '/landing',
  h(async (req, res) => {
    const { sections } = body(
      req,
      z.object({
        sections: z.array(
          z.object({
            key: z.string().regex(/^[a-z0-9_-]{1,40}$/).refine((k) => k !== 'bank', 'Use the bank settings page'),
            content: z.record(z.unknown()),
            isVisible: z.boolean().default(true),
            order: z.number().int().default(0),
          }),
        ),
      }),
    );
    await prisma.$transaction(
      sections.map((s) =>
        prisma.landingSection.upsert({
          where: { key: s.key },
          create: { key: s.key, content: s.content as Prisma.InputJsonValue, isVisible: s.isVisible, order: s.order },
          update: { content: s.content as Prisma.InputJsonValue, isVisible: s.isVisible, order: s.order },
        }),
      ),
    );
    await writeAudit(req.user!.id, 'landing.update', 'LandingSection', null, { keys: sections.map((s) => s.key) });
    res.json(await prisma.landingSection.findMany({ where: { key: { not: 'bank' } }, orderBy: { order: 'asc' } }));
  }),
);
