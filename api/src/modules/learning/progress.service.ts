// Progress rules (spec section 4, Lessons and progress).
// - watchedDelta is capped by real elapsed time since the previous update (+ tolerance) and by MAX_DELTA_SEC.
// - A lesson is completed when watchedSec >= 90% of durationSec.
// - lastPositionSec per lesson and lastLessonId per enrollment (resume). Rows are per Enrollment.cycle.
import type { Enrollment, Lesson, LessonProgress } from '@prisma/client';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { lessonStates } from './lock.service.js';

export const COMPLETE_RATIO = 0.9;
export const TOLERANCE_SEC = 3;
/** The player reports about every 10 s; anything above this in one call is not trusted. */
export const MAX_DELTA_SEC = 30;
/** First report for a lesson has no previous timestamp. */
export const FIRST_DELTA_SEC = 15;

/** Pure: how many seconds of this report may be counted. */
export function capDelta(watchedDelta: number, previousUpdateAt: Date | null, now: Date): number {
  const delta = Math.max(0, Math.floor(watchedDelta));
  if (!previousUpdateAt) return Math.min(delta, FIRST_DELTA_SEC);
  const elapsed = Math.max(0, (now.getTime() - previousUpdateAt.getTime()) / 1000);
  return Math.min(delta, Math.floor(elapsed + TOLERANCE_SEC), MAX_DELTA_SEC);
}

export function isComplete(watchedSec: number, durationSec: number): boolean {
  return durationSec > 0 && watchedSec >= Math.ceil(durationSec * COMPLETE_RATIO);
}

export async function completedLessonIds(enrollment: Enrollment): Promise<Set<string>> {
  const rows = await prisma.lessonProgress.findMany({
    where: { enrollmentId: enrollment.id, cycle: enrollment.cycle, completed: true },
    select: { lessonId: true },
  });
  return new Set(rows.map((r) => r.lessonId));
}

export async function assertLessonUnlocked(enrollment: Enrollment, lesson: Lesson) {
  // Independent reads in parallel: each DB round trip costs the network latency to the DB.
  const [lessons, done] = await Promise.all([
    prisma.lesson.findMany({ where: { courseId: lesson.courseId }, orderBy: { order: 'asc' }, select: { id: true } }),
    completedLessonIds(enrollment),
  ]);
  const states = lessonStates(lessons.map((l) => l.id), done);
  const st = states.find((s) => s.lessonId === lesson.id);
  if (!st?.unlocked) throw new AppError('LOCKED', 403, 'Finish the previous lesson first');
}

export async function recordProgress(
  enrollment: Enrollment,
  lesson: Lesson,
  input: { position: number; watchedDelta: number },
  now = new Date(),
): Promise<LessonProgress> {
  const key = { enrollmentId_lessonId_cycle: { enrollmentId: enrollment.id, lessonId: lesson.id, cycle: enrollment.cycle } };
  // The lock check and the current row are independent reads: fetch them together (a locked lesson still throws).
  const [, existing] = await Promise.all([assertLessonUnlocked(enrollment, lesson), prisma.lessonProgress.findUnique({ where: key })]);
  const counted = capDelta(input.watchedDelta, existing?.updatedAt ?? null, now);
  const duration = lesson.durationSec;
  const watchedSec = Math.min(duration > 0 ? duration : Number.MAX_SAFE_INTEGER, (existing?.watchedSec ?? 0) + counted);
  const position = Math.max(0, Math.min(Math.floor(input.position), duration > 0 ? duration : Math.floor(input.position)));
  const completed = Boolean(existing?.completed) || isComplete(watchedSec, duration);

  const [row] = await Promise.all([
    prisma.lessonProgress.upsert({
      where: key,
      create: { enrollmentId: enrollment.id, lessonId: lesson.id, cycle: enrollment.cycle, watchedSec, lastPositionSec: position, completed },
      update: { watchedSec, lastPositionSec: position, completed, updatedAt: now },
    }),
    prisma.enrollment.update({ where: { id: enrollment.id }, data: { lastLessonId: lesson.id } }),
  ]);
  return row;
}
