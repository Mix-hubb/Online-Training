// Audit log (read-only).
//   GET /admin/audit?admin&entity&from&to&page
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { query } from '../../lib/validate.js';
import { paged, parsePage } from '../../lib/pagination.js';

export const auditAdminRouter = Router();

auditAdminRouter.get(
  '/audit',
  h(async (req, res) => {
    const q = query(
      req,
      z.object({ admin: z.string().optional(), entity: z.string().optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() }).passthrough(),
    );
    const p = parsePage(req.query);
    const where: Prisma.AuditLogWhereInput = {
      ...(q.admin ? { actorId: q.admin } : {}),
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.from || q.to ? { at: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { at: 'desc' }, skip: p.skip, take: p.take, include: { actor: { select: { id: true, name: true, email: true } } } }),
      prisma.auditLog.count({ where }),
    ]);
    res.json(paged(rows, total, p));
  }),
);
