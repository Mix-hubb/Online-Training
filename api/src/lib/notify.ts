// In-app notifications.
import { prisma, type Tx } from '../db.js';

export async function notify(userId: string, text: string, link?: string, tx: Tx = prisma) {
  await tx.notification.create({ data: { userId, text, link: link ?? null } });
}
