// Pinned courses (requireAuth). Spec 15.3: max 6 per user (PIN_LIMIT), shown at the top of the home page.
//   GET    /me/pins
//   POST   /me/pins/:courseId
//   DELETE /me/pins/:courseId
import { Router } from 'express';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { requireAuth, requireLearner } from '../../middleware/auth.js';
import { cardInclude, courseCard } from '../catalog/catalog.service.js';

export const pinsRouter = Router();
export const MAX_PINS = 6;
const auth = [requireAuth, requireLearner];

pinsRouter.get(
  '/me/pins',
  ...auth,
  h(async (req, res) => {
    const pins = await prisma.userPin.findMany({
      where: { userId: req.user!.id, course: { status: { not: 'DRAFT' } } },
      orderBy: { createdAt: 'asc' },
      include: { course: { include: cardInclude } },
    });
    res.json(pins.map((p) => courseCard(p.course)));
  }),
);

pinsRouter.post(
  '/me/pins/:courseId',
  ...auth,
  h(async (req, res) => {
    const userId = req.user!.id;
    const courseId = req.params.courseId;
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { status: true } });
    if (!course || course.status === 'DRAFT') throw new AppError('NOT_FOUND', 404);
    await prisma.$transaction(async (tx) => {
      // Lock per user so two quick clicks cannot make 7 pins.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const exists = await tx.userPin.findUnique({ where: { userId_courseId: { userId, courseId } } });
      if (exists) return;
      const count = await tx.userPin.count({ where: { userId } });
      if (count >= MAX_PINS) throw new AppError('PIN_LIMIT', 409, `You can pin up to ${MAX_PINS} courses`);
      await tx.userPin.create({ data: { userId, courseId } });
    });
    res.status(201).json({ ok: true });
  }),
);

pinsRouter.delete(
  '/me/pins/:courseId',
  ...auth,
  h(async (req, res) => {
    await prisma.userPin.deleteMany({ where: { userId: req.user!.id, courseId: req.params.courseId } });
    res.json({ ok: true });
  }),
);
