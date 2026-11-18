// In-app notifications (requireAuth).
//   GET  /notifications            (latest 50 + unread count)
//   POST /notifications/:id/read
//   POST /notifications/read-all
import { Router } from 'express';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { requireAuth } from '../../middleware/auth.js';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/notifications',
  requireAuth,
  h(async (req, res) => {
    const userId = req.user!.id;
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    res.json({ items, unread });
  }),
);

notificationsRouter.post(
  '/notifications/read-all',
  requireAuth,
  h(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
    res.json({ ok: true });
  }),
);

notificationsRouter.post(
  '/notifications/:id/read',
  requireAuth,
  h(async (req, res) => {
    await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
    res.json({ ok: true });
  }),
);
