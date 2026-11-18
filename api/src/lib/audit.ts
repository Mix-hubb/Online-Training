// writeAudit(): one AuditLog row per admin mutation (spec section 4, Audit log).
import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../db.js';

export async function writeAudit(
  actorId: string | null | undefined,
  action: string,
  entity: string,
  entityId?: string | null,
  diff?: unknown,
  tx: Tx = prisma,
) {
  await tx.auditLog.create({
    data: {
      actorId: actorId ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      diff: diff === undefined ? Prisma.JsonNull : (JSON.parse(JSON.stringify(diff)) as Prisma.InputJsonValue),
    },
  });
}
