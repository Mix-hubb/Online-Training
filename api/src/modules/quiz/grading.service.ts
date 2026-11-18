// Scoring shared by auto-grading and staff (admin / instructor) essay grading.
// passed = score / maxScore >= passPercent / 100. On pass -> certificate + notification.
// After a final failed grade -> cycle reset if no attempts are left.
import { prisma, type Tx } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { notify } from '../../lib/notify.js';
import { issueCertificate } from '../certificates/certificates.service.js';
import { maybeResetCycle } from './cycle-reset.service.js';

export function isPass(score: number, maxScore: number, passPercent: number): boolean {
  return maxScore > 0 && score * 100 >= passPercent * maxScore;
}

/** First grading pass after submit: MCQ auto points; essays with text -> PENDING_REVIEW. */
export async function autoGrade(tx: Tx, attemptId: string) {
  const a = await tx.quizAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: true, quiz: { include: { questions: { include: { options: true } } } } },
  });
  let needsReview = false;
  for (const q of a.quiz.questions) {
    const ans = a.answers.find((x) => x.questionId === q.id);
    if (q.type === 'MCQ') {
      const right = Boolean(ans?.optionId && q.options.find((o) => o.id === ans.optionId)?.isCorrect);
      if (ans) await tx.attemptAnswer.update({ where: { id: ans.id }, data: { pointsAwarded: right ? q.points : 0 } });
    } else if (ans?.essayText?.trim()) {
      needsReview = true;
    } else if (ans) {
      await tx.attemptAnswer.update({ where: { id: ans.id }, data: { pointsAwarded: 0 } });
    }
  }
  if (needsReview) {
    await tx.quizAttempt.update({ where: { id: attemptId }, data: { status: 'PENDING_REVIEW', submittedAt: a.submittedAt ?? new Date() } });
    return;
  }
  await finalize(tx, attemptId);
}

/** Adds points, sets passed, issues certificate or runs cycle reset. */
export async function finalize(tx: Tx, attemptId: string) {
  const a = await tx.quizAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: true, quiz: { include: { questions: true } }, enrollment: { include: { course: true } } },
  });
  const maxScore = a.quiz.questions.reduce((s, q) => s + q.points, 0);
  const score = a.answers.reduce((s, x) => s + (x.pointsAwarded ?? 0), 0);
  const passed = isPass(score, maxScore, a.quiz.passPercent);
  await tx.quizAttempt.update({
    where: { id: attemptId },
    data: { status: 'GRADED', score, maxScore, passed, gradedAt: new Date(), submittedAt: a.submittedAt ?? new Date() },
  });
  const course = a.enrollment.course;
  if (passed) {
    await tx.enrollment.update({ where: { id: a.enrollmentId }, data: { status: 'COMPLETED', completedAt: new Date() } });
    const cert = await issueCertificate(tx, a.enrollmentId, attemptId);
    await notify(a.enrollment.userId, `You passed "${course.title}". Your certificate ${cert.number} is ready.`, `/learn/${course.slug}/result/${attemptId}`, tx);
  } else {
    await maybeResetCycle(tx, a.enrollmentId);
  }
  return { score, maxScore, passed };
}

/** Staff enters points per essay question; then the attempt is finalized. */
export async function gradeEssays(
  attemptId: string,
  grades: { questionId: string; points: number; comment?: string }[],
) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.quizAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: true, quiz: { include: { questions: true } }, enrollment: { include: { course: true } } },
    });
    if (!a) throw new AppError('NOT_FOUND', 404);
    if (a.status !== 'PENDING_REVIEW') throw new AppError('ATTEMPT_ALREADY_SUBMITTED', 409, 'This attempt is already graded');
    const essays = a.quiz.questions.filter((q) => q.type === 'ESSAY');
    for (const q of essays) {
      const g = grades.find((x) => x.questionId === q.id);
      const ans = a.answers.find((x) => x.questionId === q.id);
      if (!ans) continue;
      if (!g && ans.pointsAwarded === null) throw new AppError('VALIDATION_FAILED', 400, `Points missing for question ${q.order}`);
      if (g) {
        if (g.points > q.points) throw new AppError('VALIDATION_FAILED', 400, `Question ${q.order}: max ${q.points} points`);
        await tx.attemptAnswer.update({ where: { id: ans.id }, data: { pointsAwarded: g.points, adminComment: g.comment ?? null } });
      }
    }
    const result = await finalize(tx, attemptId);
    if (!result.passed) {
      const c = a.enrollment.course;
      await notify(a.enrollment.userId, `Your test for "${c.title}" was graded.`, `/learn/${c.slug}/result/${attemptId}`, tx);
    }
    return result;
  });
}
