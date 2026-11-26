// New round of attempts after failing all of them (spec section 4, changed 2026-11-26).
// Enrollment.cycle += 1 gives a fresh set of attempts (attempts are counted per cycle; old ones are kept
// for history). Lesson progress is NOT reset any more: it is copied into the new cycle, so the learner keeps
// every lesson they finished, can rewatch any of them, and can take the test again whenever they like.
// Only runs after grading (never while an attempt is PENDING_REVIEW).
import type { Tx } from '../../db.js';
import { notify } from '../../lib/notify.js';

export async function maybeResetCycle(tx: Tx, enrollmentId: string): Promise<boolean> {
  const e = await tx.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, include: { course: { include: { quiz: true } } } });
  const quiz = e.course.quiz;
  if (!quiz || e.status === 'COMPLETED') return false;
  const attempts = await tx.quizAttempt.findMany({ where: { enrollmentId, cycle: e.cycle } });
  if (attempts.length < quiz.maxAttempts) return false;
  if (attempts.some((a) => a.status !== 'GRADED')) return false;
  if (attempts.some((a) => a.passed)) return false;

  const next = e.cycle + 1;
  const progress = await tx.lessonProgress.findMany({ where: { enrollmentId, cycle: e.cycle } });
  await tx.enrollment.update({ where: { id: enrollmentId }, data: { cycle: next, status: 'IN_PROGRESS' } });
  if (progress.length) {
    await tx.lessonProgress.createMany({
      data: progress.map((p) => ({
        enrollmentId,
        lessonId: p.lessonId,
        cycle: next,
        watchedSec: p.watchedSec,
        lastPositionSec: p.lastPositionSec,
        completed: p.completed,
      })),
      skipDuplicates: true,
    });
  }
  await notify(
    e.userId,
    `You have ${quiz.maxAttempts} new ${quiz.maxAttempts === 1 ? 'attempt' : 'attempts'} for the final test of "${e.course.title}". Your lessons are kept: review them and try again whenever you are ready.`,
    `/learn/${e.course.slug}`,
    tx,
  );
  return true;
}
