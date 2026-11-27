// Course owner's tools (2026-11-27), mounted under /instructor (approved instructors):
//   GET    /instructor/courses/:id/team                  owner + co-instructors
//   POST   /instructor/courses/:id/team  { email }       add an approved instructor as co-instructor (owner only)
//   DELETE /instructor/courses/:id/team/:userId          (owner only; the owner cannot be removed)
//   POST   /instructor/uploads  { file, kind: cover|other }   public image (course cover, lesson images) -> { url }
// Co-instructors edit lessons and the final test, grade and answer course messages. All of the course's
// revenue share goes to the owner (InstructorProfile.sharePercentBp); co-instructors get nothing from the system.
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body, email } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { notify } from '../../lib/notify.js';
import { MAX_ADMIN_IMAGE_BYTES, decodeImage, fileInput } from '../../lib/attachments.js';
import { optimizeImage } from '../../lib/images.js';
import { storage } from '../../providers/storage/index.js';
import { assertCourse } from '../courses/access.js';
import { MAX_INSTRUCTORS } from '../admin/instructors.routes.js';

export const instructorTeamRouter = Router();

async function team(courseId: string) {
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { ownerId: true } });
  const rows = await prisma.courseInstructor.findMany({
    where: { courseId },
    orderBy: { assignedAt: 'asc' },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });
  return rows.map((r) => ({ ...r.user, owner: r.userId === course.ownerId, addedAt: r.assignedAt }));
}

instructorTeamRouter.get(
  '/courses/:id/team',
  h(async (req, res) => {
    await assertCourse(req.user, req.params.id, 'view');
    res.json(await team(req.params.id));
  }),
);

instructorTeamRouter.post(
  '/courses/:id/team',
  h(async (req, res) => {
    const input = body(req, z.object({ email }));
    const course = await assertCourse(req.user, req.params.id, 'owner');
    const u = await prisma.user.findUnique({ where: { email: input.email }, include: { instructorProfile: { select: { status: true } } } });
    if (!u || u.role !== 'INSTRUCTOR' || u.instructorProfile?.status !== 'APPROVED') {
      throw new AppError('VALIDATION_FAILED', 404, 'No approved instructor has this email');
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${course.id}))`;
      const existing = await tx.courseInstructor.findMany({ where: { courseId: course.id } });
      if (existing.some((e) => e.userId === u.id)) return;
      if (existing.length >= MAX_INSTRUCTORS) throw new AppError('INSTRUCTOR_LIMIT', 409, `A course can have at most ${MAX_INSTRUCTORS} instructors`);
      await tx.courseInstructor.create({ data: { courseId: course.id, userId: u.id, assignedBy: req.user!.id } });
      await notify(u.id, `You were added as a co-instructor of "${course.title}".`, `/instructor/courses/${course.id}`, tx);
      await writeAudit(req.user!.id, 'course.team_add', 'Course', course.id, { userId: u.id }, tx);
    });
    res.status(201).json(await team(course.id));
  }),
);

instructorTeamRouter.delete(
  '/courses/:id/team/:userId',
  h(async (req, res) => {
    const course = await assertCourse(req.user, req.params.id, 'owner');
    if (req.params.userId === course.ownerId) throw new AppError('VALIDATION_FAILED', 400, 'The course owner cannot be removed');
    await prisma.courseInstructor.deleteMany({ where: { courseId: course.id, userId: req.params.userId } });
    await writeAudit(req.user!.id, 'course.team_remove', 'Course', course.id, { userId: req.params.userId });
    res.json(await team(course.id));
  }),
);

instructorTeamRouter.post(
  '/uploads',
  h(async (req, res) => {
    const input = body(req, z.object({ file: fileInput, kind: z.enum(['cover', 'other']).default('other') }));
    const img = await optimizeImage(decodeImage(input.file, MAX_ADMIN_IMAGE_BYTES), input.kind);
    const url = await storage.putPublic(`${input.kind}/${crypto.randomUUID()}.${img.ext}`, img.buffer, img.mime);
    await writeAudit(req.user!.id, 'upload.create', 'Upload', null, { kind: input.kind, url });
    res.status(201).json({ url, width: img.width, height: img.height });
  }),
);
