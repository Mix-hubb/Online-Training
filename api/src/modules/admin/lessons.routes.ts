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

/** Two-phase renumber because of @@unique([courseId, order]). */
export async function renumber(tx: Tx, courseId: string, idsInOrder: string[]) {
  for (let i = 0; i < idsInOrder.length; i++) await tx.lesson.update({ where: { id: idsInOrder[i] }, data: { order: -(i + 1) } });
  for (let i = 0; i < idsInOrder.length; i++) await tx.lesson.update({ where: { id: idsInOrder[i] }, data: { order: i + 1 } });
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
    const { ids } = body(req, z.object({ ids: z.array(z.string()).min(1) }));
    const existing = await prisma.lesson.findMany({ where: { courseId: req.params.id }, select: { id: true } });
    const set = new Set(existing.map((e) => e.id));
    if (ids.length !== set.size || !ids.every((i) => set.has(i))) throw new AppError('VALIDATION_FAILED', 400, 'The list must contain every lesson once');
    await prisma.$transaction(async (tx) => {
      await renumber(tx, req.params.id, ids);
      await writeAudit(req.user!.id, 'lesson.reorder', 'Course', req.params.id, { ids }, tx);
    });
    res.json(await prisma.lesson.findMany({ where: { courseId: req.params.id }, orderBy: { order: 'asc' } }));
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
    const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id }, include: { course: true } });
    if (!lesson) throw new AppError('NOT_FOUND', 404);
    if (!lesson.bunnyVideoId) return res.json({ status: 'NONE' });
    const info = await video.getStatus(lesson.bunnyVideoId);
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
    res.json({ status: info.status, durationSec: info.durationSec ?? lesson.durationSec, sourceHeight, renditions: heights });
  }),
);
