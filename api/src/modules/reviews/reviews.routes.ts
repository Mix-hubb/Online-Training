// Course reviews (spec 17).
//   GET    /courses/:slug/reviews?page&pageSize   public: VISIBLE reviews + rating summary
//   GET    /me/courses/:courseId/review           { canReview, review }  (own review, any status)
//   PUT    /me/courses/:courseId/review           { rating 1..5, body }  create or edit own review
//   DELETE /me/courses/:courseId/review           remove own review
import { Router } from 'express';
import { z } from 'zod';
import { h } from '../../lib/async.js';
import { body } from '../../lib/validate.js';
import { parsePage } from '../../lib/pagination.js';
import { me, requireAuth, requireLearner } from '../../middleware/auth.js';
import { deleteMine, listPublic, myReview, upsertMine } from './reviews.service.js';

export const reviewInput = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(1, 'Please write a few words').max(2000),
});

export const reviewsRouter = Router();

reviewsRouter.get('/courses/:slug/reviews', h(async (req, res) => res.json(await listPublic(req.params.slug, parsePage(req.query)))));

reviewsRouter.get('/me/courses/:courseId/review', requireAuth, requireLearner, h(async (req, res) => res.json(await myReview(me(req).id, req.params.courseId))));

reviewsRouter.put(
  '/me/courses/:courseId/review',
  requireAuth,
  requireLearner,
  h(async (req, res) => res.json(await upsertMine(me(req).id, req.params.courseId, body(req, reviewInput)))),
);

reviewsRouter.delete(
  '/me/courses/:courseId/review',
  requireAuth,
  requireLearner,
  h(async (req, res) => {
    await deleteMine(me(req).id, req.params.courseId);
    res.status(204).end();
  }),
);
