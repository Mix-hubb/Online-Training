// Reset after failing all attempts (spec section 4).
// Enrollment.cycle += 1, status IN_PROGRESS; the new cycle starts with empty progress (rows are per cycle);
// old attempts are kept for history. Only runs after grading (never while an attempt is PENDING_REVIEW).
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

  await tx.enrollment.update({ where: { id: enrollmentId }, data: { cycle: e.cycle + 1, status: 'IN_PROGRESS', lastLessonId: null } });
  await notify(
    e.userId,
    `You used all attempts for "${e.course.title}". The lessons have restarted so you can try again.`,
    `/learn/${e.course.slug}`,
    tx,
  );
  return true;
}
