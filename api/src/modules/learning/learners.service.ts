// Learners of one course with progress and test state. Shared by admin and instructor pages.
import { prisma } from '../../db.js';

export async function courseLearners(courseId: string) {
  const [lessonCount, enrollments] = await Promise.all([
    prisma.lesson.count({ where: { courseId } }),
    prisma.enrollment.findMany({
      where: { courseId },
      orderBy: { enrolledAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        progress: { select: { cycle: true, completed: true, updatedAt: true } },
        attempts: { orderBy: { startedAt: 'desc' }, select: { id: true, cycle: true, status: true, score: true, maxScore: true, passed: true } },
        cert: { select: { number: true } },
      },
    }),
  ]);
  return enrollments.map((e) => {
    const cur = e.progress.filter((p) => p.cycle === e.cycle);
    const done = cur.filter((p) => p.completed).length;
    const last = e.attempts[0];
    return {
      enrollmentId: e.id,
      learner: e.user,
      enrolledAt: e.enrolledAt,
      status: e.status,
      cycle: e.cycle,
      completedLessons: done,
      totalLessons: lessonCount,
      percent: lessonCount ? Math.round((done / lessonCount) * 100) : 0,
      lastActivity: cur.reduce<Date>((m, p) => (p.updatedAt > m ? p.updatedAt : m), e.enrolledAt),
      attemptsThisCycle: e.attempts.filter((a) => a.cycle === e.cycle).length,
      lastAttempt: last ?? null,
      certificate: e.cert?.number ?? null,
    };
  });
}

/** Grading queue rows (PENDING_REVIEW). Pass courseIds to limit to an instructor's courses. */
export async function gradingQueue(courseIds?: string[]) {
  const rows = await prisma.quizAttempt.findMany({
    where: { status: 'PENDING_REVIEW', ...(courseIds ? { quiz: { courseId: { in: courseIds } } } : {}) },
    orderBy: { submittedAt: 'asc' },
    include: {
      enrollment: { include: { user: { select: { id: true, name: true, email: true } } } },
      quiz: { include: { course: { select: { id: true, title: true } } } },
    },
  });
  return rows.map((a) => ({
    attemptId: a.id,
    submittedAt: a.submittedAt,
    learner: a.enrollment.user,
    course: a.quiz.course,
    cycle: a.cycle,
  }));
}

/** Full attempt for a grader (staff only): includes correct answers. */
export async function attemptForGrading(attemptId: string) {
  return prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
      enrollment: { include: { user: { select: { id: true, name: true, email: true } } } },
      quiz: {
        include: {
          course: { select: { id: true, title: true } },
          questions: { orderBy: { order: 'asc' }, include: { options: true } },
        },
      },
    },
  });
}
