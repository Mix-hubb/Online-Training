// Who may do what with a course (2026-11-27: instructors own the courses they create).
//   view    : ADMIN (any course, for the review), the owner, co-instructors
//   content : lessons, final test, intro video. The owner and co-instructors. ADMIN only on older courses without
//             an owner (admin-made before this change), which admins keep managing as before.
//   test    : the final test. Like content, and the assigned instructors of an older admin-run course may manage it
//             too (allowed since 2026-11-22).
//   owner   : details, price, sending for review, archive, delete, co-instructors. The owner only
//             (ADMIN on older courses without an owner).
import type { Course, User } from '@prisma/client';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';

export type CourseLevel = 'view' | 'test' | 'content' | 'owner';

export async function assertCourse(user: User | undefined, courseId: string, level: CourseLevel): Promise<Course> {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AppError('NOT_FOUND', 404);
  if (!user) throw new AppError('UNAUTHENTICATED', 401);
  if (user.role === 'ADMIN') {
    if (level === 'view' || !course.ownerId) return course;
    throw new AppError('FORBIDDEN', 403, 'This course is managed by its instructor');
  }
  if (user.role !== 'INSTRUCTOR') throw new AppError('FORBIDDEN', 403);
  if (course.ownerId === user.id) return course;
  if (level === 'owner') throw new AppError('FORBIDDEN', 403, 'Only the course owner can do this');
  // Older admin-run course: assigned instructors see it and manage the final test, nothing else.
  if (!course.ownerId && level === 'content') throw new AppError('FORBIDDEN', 403, 'This course is managed by an admin');
  const member = await prisma.courseInstructor.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (!member) throw new AppError('NOT_ASSIGNED', 403);
  return course;
}

export async function courseIdOfLesson(lessonId: string): Promise<string> {
  const l = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { courseId: true } });
  if (!l) throw new AppError('NOT_FOUND', 404);
  return l.courseId;
}

export function assertAdmin(user: User | undefined) {
  if (user?.role !== 'ADMIN') throw new AppError('FORBIDDEN', 403);
}

/** Statuses only the course's own people (and admins) can see. */
export const HIDDEN_STATUSES = ['DRAFT', 'IN_REVIEW'] as const;
export const isHidden = (status: string) => (HIDDEN_STATUSES as readonly string[]).includes(status);
