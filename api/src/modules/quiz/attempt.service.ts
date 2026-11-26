// Start / save / submit attempts. The time limit is enforced on the server (startedAt + timeLimitMin).
// Saving after the deadline is rejected (ATTEMPT_EXPIRED); a late submit is auto-submitted with the saved answers.
import type { QuizAttempt } from '@prisma/client';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { completedLessonIds } from '../learning/progress.service.js';
import { quizUnlocked } from '../learning/lock.service.js';
import { autoGrade } from './grading.service.js';
import { attemptInclude, deadlineOf, serializeAttempt } from './attempt.serializer.js';
import type { AnswerInput } from './quiz.schemas.js';

/** Network delay allowance after the deadline. */
export const GRACE_MS = 30_000;

export function isExpired(a: Pick<QuizAttempt, 'startedAt'>, timeLimitMin: number | null, now = new Date()) {
  const d = deadlineOf(a, timeLimitMin);
  return d !== null && now.getTime() > d.getTime() + GRACE_MS;
}

async function loadOwnAttempt(userId: string, attemptId: string) {
  const a = await prisma.quizAttempt.findUnique({ where: { id: attemptId }, include: { ...attemptInclude, enrollment: true } });
  if (!a || a.enrollment.userId !== userId) throw new AppError('NOT_FOUND', 404);
  return a;
}

async function attemptsLeft(enrollmentId: string, cycle: number, maxAttempts: number) {
  const used = await prisma.quizAttempt.count({ where: { enrollmentId, cycle } });
  return Math.max(0, maxAttempts - used);
}

export async function viewAttempt(userId: string, attemptId: string) {
  let a = await loadOwnAttempt(userId, attemptId);
  if (a.status === 'IN_PROGRESS' && isExpired(a, a.quiz.timeLimitMin)) {
    await submitAttempt(userId, attemptId);
    a = await loadOwnAttempt(userId, attemptId);
  }
  const e = a.enrollment; // loaded with the attempt (fresh after the auto-submit above)
  return serializeAttempt(a, {
    learnerHasPassed: e.status === 'COMPLETED',
    attemptsLeft: await attemptsLeft(e.id, e.cycle, a.quiz.maxAttempts),
  });
}

/** Quiz intro page data: settings, lock, attempts used/left, history, open attempt. */
export async function quizOverview(userId: string, courseId: string) {
  // Independent reads in one round (attempts are found through the enrollment's user + course), then the
  // lessons done in the enrollment's current cycle. The errors are checked in the same order as before.
  const [e, quiz, lessons, attempts] = await Promise.all([
    prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } }),
    prisma.quiz.findUnique({ where: { courseId }, include: { _count: { select: { questions: true } } } }),
    prisma.lesson.findMany({ where: { courseId }, orderBy: { order: 'asc' }, select: { id: true } }),
    prisma.quizAttempt.findMany({ where: { enrollment: { userId, courseId } }, orderBy: { startedAt: 'desc' } }),
  ]);
  if (!e) throw new AppError('NOT_ENROLLED', 403);
  if (!quiz) throw new AppError('NOT_FOUND', 404);
  const unlocked = quizUnlocked(lessons.map((l) => l.id), await completedLessonIds(e));
  const cur = attempts.filter((a) => a.cycle === e.cycle);
  return {
    quizId: quiz.id,
    questionCount: quiz._count.questions,
    passPercent: quiz.passPercent,
    timeLimitMin: quiz.timeLimitMin,
    maxAttempts: quiz.maxAttempts,
    unlocked,
    passed: e.status === 'COMPLETED',
    cycle: e.cycle,
    attemptsUsed: cur.length,
    attemptsLeft: Math.max(0, quiz.maxAttempts - cur.length),
    openAttemptId: cur.find((a) => a.status === 'IN_PROGRESS')?.id ?? null,
    pendingReview: cur.some((a) => a.status === 'PENDING_REVIEW'),
    history: attempts.map((a) => ({
      id: a.id,
      cycle: a.cycle,
      status: a.status,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      score: a.status === 'GRADED' ? a.score : null,
      maxScore: a.status === 'GRADED' ? a.maxScore : null,
      passed: a.status === 'GRADED' ? a.passed : null,
    })),
  };
}

export async function startAttempt(userId: string, courseId: string) {
  const e = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (!e) throw new AppError('NOT_ENROLLED', 403);
  if (e.status === 'COMPLETED') throw new AppError('QUIZ_LOCKED', 403, 'You already passed this test');
  const quiz = await prisma.quiz.findUnique({ where: { courseId }, include: { _count: { select: { questions: true } } } });
  if (!quiz || quiz._count.questions === 0) throw new AppError('NOT_FOUND', 404);

  const lessons = await prisma.lesson.findMany({ where: { courseId }, orderBy: { order: 'asc' }, select: { id: true } });
  if (!quizUnlocked(lessons.map((l) => l.id), await completedLessonIds(e))) {
    throw new AppError('QUIZ_LOCKED', 403, 'Finish all lessons first');
  }

  const cur = await prisma.quizAttempt.findMany({ where: { enrollmentId: e.id, cycle: e.cycle } });
  const open = cur.find((a) => a.status === 'IN_PROGRESS');
  if (open) {
    if (!isExpired(open, quiz.timeLimitMin)) return viewAttempt(userId, open.id);
    await submitAttempt(userId, open.id);
    return startAttempt(userId, courseId);
  }
  if (cur.some((a) => a.status === 'PENDING_REVIEW')) {
    throw new AppError('QUIZ_LOCKED', 403, 'Your last attempt is waiting for the instructor');
  }
  if (cur.length >= quiz.maxAttempts) throw new AppError('NO_ATTEMPTS_LEFT', 403);

  const a = await prisma.quizAttempt.create({ data: { enrollmentId: e.id, quizId: quiz.id, cycle: e.cycle } });
  return viewAttempt(userId, a.id);
}

async function writeAnswers(attemptId: string, questions: { id: string; type: string; options: { id: string }[] }[], answers: AnswerInput[]) {
  for (const ans of answers) {
    const q = questions.find((x) => x.id === ans.questionId);
    if (!q) throw new AppError('VALIDATION_FAILED', 400, 'Unknown question');
    const data =
      q.type === 'MCQ'
        ? { optionId: ans.optionId ?? null, essayText: null }
        : { optionId: null, essayText: ans.essayText ?? null };
    if (q.type === 'MCQ' && data.optionId && !q.options.some((o) => o.id === data.optionId)) {
      throw new AppError('VALIDATION_FAILED', 400, 'Unknown option');
    }
    await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: q.id } },
      create: { attemptId, questionId: q.id, ...data },
      update: data,
    });
  }
}

export async function saveAnswers(userId: string, attemptId: string, answers: AnswerInput[]) {
  const a = await loadOwnAttempt(userId, attemptId);
  if (a.status !== 'IN_PROGRESS') throw new AppError('ATTEMPT_ALREADY_SUBMITTED', 409);
  if (isExpired(a, a.quiz.timeLimitMin)) {
    await submitAttempt(userId, attemptId);
    throw new AppError('ATTEMPT_EXPIRED', 409, 'Time is up. Your saved answers were submitted.');
  }
  await writeAnswers(a.id, a.quiz.questions, answers);
  return { ok: true, savedAt: new Date() };
}

export async function submitAttempt(userId: string, attemptId: string, finalAnswers?: AnswerInput[]) {
  const a = await loadOwnAttempt(userId, attemptId);
  if (a.status !== 'IN_PROGRESS') throw new AppError('ATTEMPT_ALREADY_SUBMITTED', 409);
  const late = isExpired(a, a.quiz.timeLimitMin);
  // Answers sent with a late submit are ignored: only what was saved in time counts.
  if (finalAnswers?.length && !late) await writeAnswers(a.id, a.quiz.questions, finalAnswers);

  await prisma.$transaction(async (tx) => {
    // Guard against double submit: only one request can set submittedAt.
    const flipped = await tx.quizAttempt.updateMany({
      where: { id: a.id, status: 'IN_PROGRESS', submittedAt: null },
      data: { submittedAt: new Date() },
    });
    if (flipped.count === 0) throw new AppError('ATTEMPT_ALREADY_SUBMITTED', 409);
    await autoGrade(tx, a.id);
  });
  return { late };
}
