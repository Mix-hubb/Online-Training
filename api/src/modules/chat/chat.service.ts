// Private chat (spec 15.4). Access rules:
//   SUPPORT: the learner + admins.
//   COURSE:  the learner + that course's assigned instructors (+ admins).
//   Anyone else -> 404 (do not reveal that the thread exists).
import type { Prisma, SupportThread, User } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { notify } from '../../lib/notify.js';
import { decodeImages, fileInput, privateKey } from '../../lib/attachments.js';
import { optimizeImage } from '../../lib/images.js';
import { storage } from '../../providers/storage/index.js';

export const ATTACHMENT_URL_TTL = 300;

export const messageBody = z
  .object({
    body: z.string().trim().max(2000).default(''),
    attachments: z.array(fileInput).max(3).default([]),
  })
  .refine((m) => m.body.length > 0 || m.attachments.length > 0, { message: 'Write a message or add an image' });

export type Side = 'learner' | 'staff';

export async function sideOf(user: User, thread: SupportThread): Promise<Side | null> {
  if (thread.userId === user.id) return 'learner';
  if (user.role === 'ADMIN') return 'staff';
  if (user.role === 'INSTRUCTOR' && thread.type === 'COURSE' && thread.courseId) {
    const a = await prisma.courseInstructor.findUnique({ where: { courseId_userId: { courseId: thread.courseId, userId: user.id } } });
    if (a) return 'staff';
  }
  return null;
}

export async function loadThreadFor(user: User, threadId: string) {
  const thread = await prisma.supportThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new AppError('NOT_FOUND', 404);
  const side = await sideOf(user, thread);
  if (!side) throw new AppError('NOT_FOUND', 404);
  return { thread, side };
}

const threadInclude = {
  user: { select: { id: true, name: true, avatarUrl: true } },
  course: { select: { id: true, title: true, slug: true } },
  messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, senderId: true, createdAt: true } },
} satisfies Prisma.SupportThreadInclude;

type ThreadRow = Prisma.SupportThreadGetPayload<{ include: typeof threadInclude }>;

/**
 * Unread messages per thread, in ONE query (2026-11-23: was one count per thread, up to 200 queries on every
 * 15-second inbox refresh). Learner: messages from staff since userReadAt. Staff: messages from the learner since staffReadAt.
 */
async function unreadCounts(ids: string[], side: Side): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows =
    side === 'learner'
      ? await prisma.$queryRaw<{ id: string; n: number }[]>`
          SELECT m."threadId" AS id, COUNT(*)::int AS n
          FROM "ThreadMessage" m JOIN "SupportThread" t ON t.id = m."threadId"
          WHERE m."threadId" = ANY(${ids}) AND m."senderId" <> t."userId"
            AND (t."userReadAt" IS NULL OR m."createdAt" > t."userReadAt")
          GROUP BY m."threadId"`
      : await prisma.$queryRaw<{ id: string; n: number }[]>`
          SELECT m."threadId" AS id, COUNT(*)::int AS n
          FROM "ThreadMessage" m JOIN "SupportThread" t ON t.id = m."threadId"
          WHERE m."threadId" = ANY(${ids}) AND m."senderId" = t."userId"
            AND (t."staffReadAt" IS NULL OR m."createdAt" > t."staffReadAt")
          GROUP BY m."threadId"`;
  return new Map(rows.map((r) => [r.id, Number(r.n)]));
}

export async function threadList(where: Prisma.SupportThreadWhereInput, side: Side) {
  const rows: ThreadRow[] = await prisma.supportThread.findMany({ where, include: threadInclude, orderBy: { lastMessageAt: 'desc' }, take: 200 });
  const unread = await unreadCounts(rows.map((t) => t.id), side);
  return rows.map((t) => ({
      id: t.id,
      type: t.type,
      subject: t.subject,
      status: t.status,
      lastMessageAt: t.lastMessageAt,
      learner: side === 'staff' ? t.user : undefined,
      course: t.course,
      // mine: sent by this side (learner, or any staff member), so the list can say "You: ..."
      lastMessage: t.messages[0]
        ? { body: t.messages[0].body.slice(0, 140), mine: (t.messages[0].senderId === t.userId) === (side === 'learner'), at: t.messages[0].createdAt }
        : null,
      unread: unread.get(t.id) ?? 0,
    }));
}

export async function threadMessages(user: User, threadId: string) {
  const { thread, side } = await loadThreadFor(user, threadId);
  const msgs = await prisma.threadMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, name: true, role: true, avatarUrl: true } },
      attachments: { select: { id: true, mime: true, sizeBytes: true, width: true, height: true } },
    },
  });
  await markRead(thread, side);
  const full = await prisma.supportThread.findUniqueOrThrow({ where: { id: threadId }, include: threadInclude });
  return {
    thread: {
      id: full.id,
      type: full.type,
      subject: full.subject,
      status: full.status,
      course: full.course,
      learner: side === 'staff' ? full.user : undefined,
    },
    side,
    messages: msgs.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      mine: m.senderId === user.id,
      fromStaff: m.senderId !== thread.userId,
      sender: { id: m.sender.id, name: m.sender.name, avatarUrl: m.sender.avatarUrl, role: m.sender.role },
      attachments: m.attachments,
    })),
  };
}

export async function markRead(thread: SupportThread, side: Side) {
  await prisma.supportThread.update({
    where: { id: thread.id },
    data: side === 'learner' ? { userReadAt: new Date() } : { staffReadAt: new Date() },
  });
}

async function staffToNotify(thread: SupportThread): Promise<string[]> {
  if (thread.type === 'COURSE' && thread.courseId) {
    const ins = await prisma.courseInstructor.findMany({ where: { courseId: thread.courseId }, select: { userId: true } });
    if (ins.length) return ins.map((i) => i.userId);
  }
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
  return admins.map((a) => a.id);
}

export async function postMessage(user: User, thread: SupportThread, side: Side, input: z.infer<typeof messageBody>) {
  const images = await Promise.all(decodeImages(input.attachments).map((i) => optimizeImage(i, 'chat')));
  const keys: { key: string; mime: string; size: number; width?: number; height?: number }[] = [];
  for (const img of images) {
    const key = privateKey(`chat/${thread.id}`, img.ext);
    await storage.putPrivate(key, img.buffer, img.mime);
    keys.push({ key, mime: img.mime, size: img.buffer.length, width: img.width, height: img.height });
  }
  const now = new Date();
  const msg = await prisma.$transaction(async (tx) => {
    const m = await tx.threadMessage.create({
      data: {
        threadId: thread.id,
        senderId: user.id,
        body: input.body,
        attachments: { create: keys.map((k) => ({ storageKey: k.key, mime: k.mime, sizeBytes: k.size, width: k.width, height: k.height })) },
      },
      include: { attachments: { select: { id: true, mime: true, sizeBytes: true, width: true, height: true } } },
    });
    await tx.supportThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: now,
        status: 'OPEN',
        ...(side === 'learner' ? { userReadAt: now } : { staffReadAt: now }),
      },
    });
    return m;
  });

  const text = side === 'learner' ? `New message from ${user.name}: ${thread.subject}` : `New reply: ${thread.subject}`;
  if (side === 'learner') {
    const staff = await staffToNotify(thread);
    const link = thread.type === 'SUPPORT' ? `/admin/support/${thread.id}` : `/instructor/messages/${thread.id}`;
    for (const id of staff) await notify(id, text, link);
  } else {
    await notify(thread.userId, text, `/messages/${thread.id}`);
  }
  return { id: msg.id, body: msg.body, createdAt: msg.createdAt, mine: true, attachments: msg.attachments };
}

export async function attachmentUrl(user: User, attachmentId: string) {
  const a = await prisma.messageAttachment.findUnique({ where: { id: attachmentId }, include: { message: { include: { thread: true } } } });
  if (!a) throw new AppError('NOT_FOUND', 404);
  if (!(await sideOf(user, a.message.thread))) throw new AppError('NOT_FOUND', 404);
  return { url: await storage.signedUrl(a.storageKey, ATTACHMENT_URL_TTL), expiresInSec: ATTACHMENT_URL_TTL };
}
