// Lesson CRUD + video upload (open decision 10.4: default = admin page uploads straight to the provider).
//   POST   /admin/courses/:id/lessons
//   PATCH  /admin/lessons/:id
//   DELETE /admin/lessons/:id
//   PUT    /admin/courses/:id/lessons/order  { ids: [...] }
//   POST   /admin/lessons/:id/upload-init    -> { providerVideoId, uploadUrl, uploadHeaders }
//   GET    /admin/lessons/:id/video-status   -> PROCESSING / READY / FAILED + duration + renditions
import { Router } from 'express';
import { z } from 'zod';
import { prisma, type Tx } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { video, allowedRenditions } from '../../providers/video/index.js';

export const lessonsAdminRouter = Router();

const lessonFields = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().max(5000).nullable().optional(),
  attachmentUrls: z.array(z.string().url()).max(10).optional(),
  durationSec: z.number().int().min(0).optional(),
});

/**
 * Sets order = position in idsInOrder (1-based). Two statements, whatever the lesson count (it used to be two
 * UPDATEs per lesson, one DB round trip each: slow when the DB is far away). Negative first because of
 * @@unique([courseId, order]). Throws `onMismatch()` (rolling back the transaction) when idsInOrder does not
 * match every lesson of the course, before any clash with the unique index can happen.
 */
export async function renumber(tx: Tx, courseId: string, idsInOrder: string[], onMismatch?: () => Error): Promise<void> {
  const n = await tx.$executeRaw`
    UPDATE "Lesson" l SET "order" = -t.ord::int
    FROM unnest(${idsInOrder}::text[]) WITH ORDINALITY AS t(id, ord)
    WHERE l."id" = t.id AND l."courseId" = ${courseId}`;
  if (onMismatch) {
    const left = await tx.lesson.count({ where: { courseId, order: { gt: 0 } } });
    if (n !== idsInOrder.length || left > 0) throw onMismatch();
  }
  await tx.$executeRaw`UPDATE "Lesson" SET "order" = -"order" WHERE "courseId" = ${courseId} AND "order" < 0`;
}

lessonsAdminRouter.post(
  '/courses/:id/lessons',
  h(async (req, res) => {
    const input = body(req, lessonFields);
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) throw new AppError('NOT_FOUND', 404);
    const last = await prisma.lesson.findFirst({ where: { courseId: course.id }, orderBy: { order: 'desc' } });
    const lesson = await prisma.lesson.create({
      data: { ...input, attachmentUrls: input.attachmentUrls ?? [], courseId: course.id, order: (last?.order ?? 0) + 1 },
    });
    await writeAudit(req.user!.id, 'lesson.create', 'Lesson', lesson.id, input);
    res.status(201).json(lesson);
  }),
);

lessonsAdminRouter.patch(
  '/lessons/:id',
  h(async (req, res) => {
    const input = body(req, lessonFields.partial());
    const lesson = await prisma.lesson.update({ where: { id: req.params.id }, data: input }).catch(() => {
      throw new AppError('NOT_FOUND', 404);
    });
    await writeAudit(req.user!.id, 'lesson.update', 'Lesson', lesson.id, input);
    res.json(lesson);
  }),
);

lessonsAdminRouter.delete(
  '/lessons/:id',
  h(async (req, res) => {
    const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id } });
    if (!lesson) throw new AppError('NOT_FOUND', 404);
    await prisma.$transaction(async (tx) => {
      await tx.lesson.delete({ where: { id: lesson.id } });
      const rest = await tx.lesson.findMany({ where: { courseId: lesson.courseId }, orderBy: { order: 'asc' }, select: { id: true } });
      await renumber(tx, lesson.courseId, rest.map((r) => r.id));
      await writeAudit(req.user!.id, 'lesson.delete', 'Lesson', lesson.id, { title: lesson.title }, tx);
    });
    if (lesson.bunnyVideoId) await video.deleteVideo(lesson.bunnyVideoId).catch(() => undefined);
    res.json({ ok: true });
  }),
);

lessonsAdminRouter.put(
  '/courses/:id/lessons/order',
  h(async (req, res) => {
    // Few round trips on purpose (the admin drags lessons and expects it to stick at once): the check that the
    // list holds every lesson of the course exactly once happens inside the transaction, from the row counts.
    const { ids } = body(req, z.object({ ids: z.array(z.string()).min(1).max(1000) }));
    const bad = () => new AppError('VALIDATION_FAILED', 400, 'The list must contain every lesson once');
    if (new Set(ids).size !== ids.length) throw bad();
    await prisma.$transaction(async (tx) => {
      await renumber(tx, req.params.id, ids, bad);
      await writeAudit(req.user!.id, 'lesson.reorder', 'Course', req.params.id, { ids }, tx);
    });
    res.json({ ok: true });
  }),
);

lessonsAdminRouter.post(
  '/lessons/:id/upload-init',
  h(async (req, res) => {
    const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id } });
    if (!lesson) throw new AppError('NOT_FOUND', 404);
    if (lesson.bunnyVideoId) await video.deleteVideo(lesson.bunnyVideoId).catch(() => undefined);
    const v = await video.createVideo(lesson.title);
    await prisma.$transaction([
      prisma.lessonRendition.deleteMany({ where: { lessonId: lesson.id } }),
      prisma.lesson.update({ where: { id: lesson.id }, data: { bunnyVideoId: v.providerVideoId, videoStatus: 'PROCESSING', sourceHeight: null } }),
    ]);
    await writeAudit(req.user!.id, 'lesson.video_upload', 'Lesson', lesson.id);
    res.json(v);
  }),
);

lessonsAdminRouter.get(
  '/lessons/:id/video-status',
  h(async (req, res) => {
    const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id }, select: { id: true, bunnyVideoId: true } });
    if (!lesson) throw new AppError('NOT_FOUND', 404);
    if (!lesson.bunnyVideoId) return res.json({ status: 'NONE' });
    res.json(await syncVideoStatus(lesson.id));
  }),
);

/** Asks the video provider for a lesson's status and saves it (admin page poll and the Bunny webhook). */
export async function syncVideoStatus(lessonId: string) {
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { course: true } });
  const info = await video.getStatus(lesson.bunnyVideoId!);
  const sourceHeight = info.sourceHeight ?? lesson.sourceHeight;
  const heights = allowedRenditions(sourceHeight, lesson.course.allow4k);
  await prisma.$transaction([
    prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        videoStatus: info.status,
        ...(info.durationSec ? { durationSec: info.durationSec } : {}),
        ...(sourceHeight ? { sourceHeight } : {}),
      },
    }),
    ...heights.map((height) =>
      prisma.lessonRendition.upsert({
        where: { lessonId_height: { lessonId: lesson.id, height } },
        create: { lessonId: lesson.id, height, ready: Boolean(info.readyHeights?.includes(height)) },
        update: { ready: Boolean(info.readyHeights?.includes(height)) },
      }),
    ),
  ]);
  return { status: info.status, durationSec: info.durationSec ?? lesson.durationSec, sourceHeight, renditions: heights };
}
