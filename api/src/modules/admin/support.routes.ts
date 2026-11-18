// Support inbox (spec 15.4). Reading/replying uses the shared /threads/:id endpoints.
//   GET /admin/threads?type=SUPPORT|COURSE&status=OPEN|CLOSED&unread=true
import { Router } from 'express';
import { z } from 'zod';
import { h } from '../../lib/async.js';
import { query } from '../../lib/validate.js';
import { threadList } from '../chat/chat.service.js';

export const supportAdminRouter = Router();

supportAdminRouter.get(
  '/threads',
  h(async (req, res) => {
    const q = query(
      req,
      z.object({
        type: z.enum(['SUPPORT', 'COURSE']).optional(),
        status: z.enum(['OPEN', 'CLOSED']).optional(),
        unread: z.enum(['true', 'false']).optional(),
      }),
    );
    const rows = await threadList({ ...(q.type ? { type: q.type } : {}), ...(q.status ? { status: q.status } : {}) }, 'staff');
    res.json(q.unread === 'true' ? rows.filter((r) => r.unread > 0) : rows);
  }),
);
