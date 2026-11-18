// Private chat (requireAuth). Spec 15.4. The thread endpoints are shared by learners and staff;
// the access check (chat.service sideOf) decides who may read or write.
//   GET  /me/threads                         (my support + course threads, unread counts)
//   POST /me/threads/support  { subject, body, attachments }  (opens a support thread)
//   POST /courses/:id/threads { subject, body, attachments }  (course question, enrolled only)
//   GET  /threads/:id/messages
//   POST /threads/:id/messages { body, attachments }  (text + up to 3 images, 5 MB each)
//   POST /threads/:id/read
//   POST /threads/:id/close                  (staff)
//   GET  /attachments/:id/url                (short-lived signed link, participants only)
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { attachmentUrl, loadThreadFor, markRead, messageBody, postMessage, threadList, threadMessages } from './chat.service.js';

export const chatRouter = Router();

const newThread = z.object({ subject: z.string().trim().min(1).max(150) });

chatRouter.get('/me/threads', requireAuth, h(async (req, res) => res.json(await threadList({ userId: req.user!.id }, 'learner'))));

chatRouter.post(
  '/me/threads/support',
  requireAuth,
  h(async (req, res) => {
    const user = req.user!;
    const { subject } = body(req, newThread.passthrough());
    const msg = body(req, messageBody);
    const thread = await prisma.supportThread.create({ data: { type: 'SUPPORT', userId: user.id, subject } });
    await postMessage(user, thread, 'learner', msg);
    res.status(201).json({ id: thread.id });
  }),
);

chatRouter.post(
  '/courses/:id/threads',
  requireAuth,
  h(async (req, res) => {
    const user = req.user!;
    const { subject } = body(req, newThread.passthrough());
    const msg = body(req, messageBody);
    const enrolled = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: req.params.id } } });
    if (!enrolled) throw new AppError('NOT_ENROLLED', 403);
    const thread = await prisma.supportThread.create({ data: { type: 'COURSE', userId: user.id, courseId: req.params.id, subject } });
    await postMessage(user, thread, 'learner', msg);
    res.status(201).json({ id: thread.id });
  }),
);

chatRouter.get('/threads/:id/messages', requireAuth, h(async (req, res) => res.json(await threadMessages(req.user!, req.params.id))));

chatRouter.post(
  '/threads/:id/messages',
  requireAuth,
  h(async (req, res) => {
    const { thread, side } = await loadThreadFor(req.user!, req.params.id);
    res.status(201).json(await postMessage(req.user!, thread, side, body(req, messageBody)));
  }),
);

chatRouter.post(
  '/threads/:id/read',
  requireAuth,
  h(async (req, res) => {
    const { thread, side } = await loadThreadFor(req.user!, req.params.id);
    await markRead(thread, side);
    res.json({ ok: true });
  }),
);

chatRouter.post(
  '/threads/:id/close',
  requireAuth,
  h(async (req, res) => {
    const { thread, side } = await loadThreadFor(req.user!, req.params.id);
    if (side !== 'staff') throw new AppError('FORBIDDEN', 403);
    await prisma.supportThread.update({ where: { id: thread.id }, data: { status: 'CLOSED' } });
    res.json({ ok: true });
  }),
);

chatRouter.get('/attachments/:id/url', requireAuth, h(async (req, res) => res.json(await attachmentUrl(req.user!, req.params.id))));
