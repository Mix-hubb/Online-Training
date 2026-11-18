// The ONE place that shapes attempt responses for learners (spec section 4, Answer review rule).
// Correct answers, per-question right/wrong and instructor comments are returned ONLY when the learner has passed.
import type { Prisma } from '@prisma/client';

export const attemptInclude = {
  answers: true,
  quiz: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } },
} satisfies Prisma.QuizAttemptInclude;

export type FullAttempt = Prisma.QuizAttemptGetPayload<{ include: typeof attemptInclude }>;

export function deadlineOf(a: { startedAt: Date }, timeLimitMin: number | null): Date | null {
  return timeLimitMin ? new Date(a.startedAt.getTime() + timeLimitMin * 60_000) : null;
}

export function serializeAttempt(a: FullAttempt, opts: { learnerHasPassed: boolean; attemptsLeft: number }) {
  const base = {
    id: a.id,
    status: a.status,
    cycle: a.cycle,
    startedAt: a.startedAt,
    submittedAt: a.submittedAt,
    deadline: deadlineOf(a, a.quiz.timeLimitMin),
    score: a.status === 'GRADED' ? a.score : null,
    maxScore: a.status === 'GRADED' ? a.maxScore : null,
    percent: a.status === 'GRADED' && a.maxScore ? Math.round(((a.score ?? 0) / a.maxScore) * 100) : null,
    passed: a.status === 'GRADED' ? a.passed : null,
    passPercent: a.quiz.passPercent,
    attemptsLeft: opts.attemptsLeft,
  };

  if (a.status === 'IN_PROGRESS') {
    return {
      ...base,
      questions: a.quiz.questions.map((q) => ({
        id: q.id,
        order: q.order,
        type: q.type,
        text: q.text,
        points: q.points,
        options: q.type === 'MCQ' ? q.options.map((o) => ({ id: o.id, text: o.text })) : [],
      })),
      answers: a.answers.map((x) => ({ questionId: x.questionId, optionId: x.optionId, essayText: x.essayText })),
    };
  }

  if (!opts.learnerHasPassed) return base;

  return {
    ...base,
    review: a.quiz.questions.map((q) => {
      const ans = a.answers.find((x) => x.questionId === q.id);
      const correct = q.options.find((o) => o.isCorrect);
      return {
        id: q.id,
        order: q.order,
        type: q.type,
        text: q.text,
        points: q.points,
        options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
        yourOptionId: ans?.optionId ?? null,
        yourEssay: ans?.essayText ?? null,
        correctOptionId: correct?.id ?? null,
        pointsAwarded: ans?.pointsAwarded ?? 0,
        isRight: q.type === 'MCQ' ? Boolean(correct && ans?.optionId === correct.id) : (ans?.pointsAwarded ?? 0) >= q.points,
        comment: ans?.adminComment ?? null,
      };
    }),
  };
}
