// Course question threads for assigned courses. Reading/replying uses the shared /threads/:id endpoints
// (chat.service checks the assignment).
//   GET /instructor/threads?status=OPEN|CLOSED
import { Router } from 'express';
import { z } from 'zod';
import { h } from '../../lib/async.js';
import { query } from '../../lib/validate.js';
import { threadList } from '../chat/chat.service.js';
import { myCourseIds } from './courses.routes.js';

export const instructorChatRouter = Router();

instructorChatRouter.get(
  '/threads',
  h(async (req, res) => {
    const q = query(req, z.object({ status: z.enum(['OPEN', 'CLOSED']).optional() }));
    const ids = await myCourseIds(req.user!.id);
    res.json(await threadList({ type: 'COURSE', courseId: { in: ids }, ...(q.status ? { status: q.status } : {}) }, 'staff'));
  }),
);
