// Enrollment helpers + "My learning" status.
import { isHidden } from '../courses/access.js';
import type { Enrollment } from '@prisma/client';
import { prisma, type Tx } from '../../db.js';
import { AppError } from '../../lib/errors.js';

export async function getEnrollmentOrThrow(userId: string, courseId: string) {
  const e = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (!e) throw new AppError('NOT_ENROLLED', 403);
  return e;
}

/** Creates the enrollment once; a second call returns the existing row. */
export async function ensureEnrollment(userId: string, courseId: string, tx: Tx = prisma): Promise<Enrollment> {
  return tx.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId },
    update: {},
  });
}

export async function enrollFree(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || isHidden(course.status)) throw new AppError('NOT_FOUND', 404);
  if (course.status !== 'PUBLISHED') throw new AppError('COURSE_UNAVAILABLE', 410);
  if (!course.isFree) throw new AppError('NOT_FREE', 402);
  const existing = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (existing) throw new AppError('ALREADY_ENROLLED', 409);
  return ensureEnrollment(userId, courseId);
}

export type LearningStatus = 'IN_PROGRESS' | 'READY_FOR_TEST' | 'WAITING_FOR_INSTRUCTOR' | 'LESSONS_RESTARTED' | 'COMPLETED';

export async function myCourses(userId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    orderBy: { enrolledAt: 'desc' },
    include: {
      course: { select: { id: true, slug: true, title: true, thumbnailUrl: true, status: true, lessons: { select: { id: true, title: true } } } },
      progress: { select: { lessonId: true, cycle: true, completed: true, updatedAt: true } },
      attempts: { select: { cycle: true, status: true } },
      cert: { select: { id: true, number: true } },
    },
  });
  return enrollments.map((e) => {
    const cur = e.progress.filter((p) => p.cycle === e.cycle);
    const done = cur.filter((p) => p.completed).length;
    const total = e.course.lessons.length;
    let status: LearningStatus = 'IN_PROGRESS';
    if (e.status === 'COMPLETED') status = 'COMPLETED';
    else if (e.attempts.some((a) => a.cycle === e.cycle && a.status === 'PENDING_REVIEW')) status = 'WAITING_FOR_INSTRUCTOR';
    else if (total > 0 && done === total) status = 'READY_FOR_TEST';
    else if (e.cycle > 1 && cur.length === 0) status = 'LESSONS_RESTARTED';
    const lastActivity = cur.reduce<Date>((m, p) => (p.updatedAt > m ? p.updatedAt : m), e.enrolledAt);
    const lastLesson = e.course.lessons.find((l) => l.id === e.lastLessonId) ?? null;
    return {
      enrollmentId: e.id,
      course: { id: e.course.id, slug: e.course.slug, title: e.course.title, thumbnailUrl: e.course.thumbnailUrl, status: e.course.status },
      status,
      cycle: e.cycle,
      completedLessons: done,
      totalLessons: total,
      percent: total ? Math.round((done / total) * 100) : 0,
      lastLesson,
      lastActivity,
      certificate: e.cert,
    };
  });
}
