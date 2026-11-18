// Public catalog.
//   GET /courses?q&category&level&price&tag&page  (PUBLISHED only)
//   GET /courses/:slug  (PUBLISHED; ARCHIVED only for owners; DRAFT only for admins/preview)
//   GET /courses/:slug/intro  (signed preview video URL, public)
//   GET /categories
//   GET /tags
import { Router } from 'express';
import { h } from '../../lib/async.js';
import { query } from '../../lib/validate.js';
import { optionalAuth } from '../../middleware/auth.js';
import { courseListQuery } from './catalog.schemas.js';
import { courseDetail, listCategories, listCourses, listTags } from './catalog.service.js';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { video } from '../../providers/video/index.js';

export const catalogRouter = Router();

catalogRouter.get('/courses', h(async (req, res) => res.json(await listCourses(query(req, courseListQuery)))));

catalogRouter.get('/courses/:slug', optionalAuth, h(async (req, res) => res.json(await courseDetail(req.params.slug, req.user))));

catalogRouter.get(
  '/courses/:slug/intro',
  h(async (req, res) => {
    const c = await prisma.course.findUnique({ where: { slug: req.params.slug }, select: { introVideoId: true, status: true } });
    if (!c || c.status !== 'PUBLISHED' || !c.introVideoId) throw new AppError('NOT_FOUND', 404);
    res.json({ url: await video.getSignedPlaybackUrl(c.introVideoId, 3600) });
  }),
);

catalogRouter.get('/categories', h(async (_req, res) => res.json(await listCategories())));
catalogRouter.get('/tags', h(async (_req, res) => res.json(await listTags())));
