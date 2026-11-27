// Enrollment, player, progress (requireAuth).
//   POST /courses/:id/enroll        (free + PUBLISHED only; paid -> NOT_FREE)
//   GET  /me/courses                (My learning + status per course)
//   GET  /me/continue               (last lesson per enrollment for Resume buttons)
//   GET  /courses/:slug/learn       (lessons + progress for current cycle + lock state + quiz lock)
//   GET  /lessons/:id/play          (signed short-lived URL; owner, admin or assigned instructor; LOCKED if previous not done;
//                                    a free preview lesson of a PUBLISHED course: any signed-in user)
//   PUT  /lessons/:id/progress      { position, watchedDelta }
import { Router } from 'express';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body } from '../../lib/validate.js';
import { requireAuth, requireLearner } from '../../middleware/auth.js';
import { isAssigned } from '../../middleware/roles.js';
import { isHidden } from '../courses/access.js';
import { video, allowedRenditions } from '../../providers/video/index.js';
import { enrollFree, myCourses } from './enrollment.service.js';
import { lessonStates, quizUnlocked } from './lock.service.js';
import { assertLessonUnlocked, recordProgress } from './progress.service.js';
import { progressBody } from './learning.schemas.js';

export const learningRouter = Router();
const auth = [requireAuth, requireLearner];

const PLAY_TTL_SEC = 2 * 3600;

learningRouter.post(
  '/courses/:id/enroll',
  ...auth,
  h(async (req, res) => {
    const e = await enrollFree(req.user!.id, req.params.id);
    res.status(201).json({ enrollmentId: e.id });
  }),
);

learningRouter.get('/me/courses', ...auth, h(async (req, res) => res.json(await myCourses(req.user!.id))));

learningRouter.get(
  '/me/continue',
  ...auth,
  h(async (req, res) => {
    const all = await myCourses(req.user!.id);
    const rows = all
      .filter((c) => c.status !== 'COMPLETED' && !isHidden(c.course.status))
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
      .slice(0, 8);
    res.json(rows);
  }),
);

async function staffCanPreview(userId: string, role: string, courseId: string) {
  return role === 'ADMIN' || (role === 'INSTRUCTOR' && (await isAssigned(userId, courseId)));
}

learningRouter.get(
  '/courses/:slug/learn',
  ...auth,
  h(async (req, res) => {
    const user = req.user!;
    // The course and the learner's enrollment (looked up by the course slug) in one round of queries.
    const [course, enrollment] = await Promise.all([
      prisma.course.findUnique({
        where: { slug: req.params.slug },
        include: {
          lessons: { orderBy: { order: 'asc' } },
          quiz: { select: { id: true, passPercent: true, timeLimitMin: true, maxAttempts: true, _count: { select: { questions: true } } } },
        },
      }),
      prisma.enrollment.findFirst({ where: { userId: user.id, course: { slug: req.params.slug } } }),
    ]);
    if (!course) throw new AppError('NOT_FOUND', 404);
    const preview = !enrollment && (await staffCanPreview(user.id, user.role, course.id));
    // Not enrolled: a PUBLISHED course with free preview lessons opens with only those lessons unlocked.
    const freeOnly = !enrollment && !preview && course.status === 'PUBLISHED' && course.lessons.some((l) => l.isFreePreview);
    if (!enrollment && !preview && !freeOnly) throw new AppError('NOT_ENROLLED', 403);
    if (enrollment && isHidden(course.status) && user.role !== 'ADMIN') throw new AppError('NOT_FOUND', 404);

    const ids = course.lessons.map((l) => l.id);
    const [progress, attemptsUsed] = await Promise.all([
      enrollment ? prisma.lessonProgress.findMany({ where: { enrollmentId: enrollment.id, cycle: enrollment.cycle } }) : [],
      enrollment && course.quiz ? prisma.quizAttempt.count({ where: { enrollmentId: enrollment.id, cycle: enrollment.cycle } }) : 0,
    ]);
    // The same set completedLessonIds() returns (completed rows of the current cycle), from the rows already loaded.
    const done = enrollment
      ? new Set(progress.filter((p) => p.completed).map((p) => p.lessonId))
      : freeOnly
        ? new Set<string>()
        : new Set(ids);
    const states = lessonStates(ids, done).map((st, i) => {
      const free = course.lessons[i].isFreePreview;
      return { ...st, unlocked: freeOnly ? free : st.unlocked || free };
    });

    res.json({
      preview,
      freePreview: freeOnly,
      course: { id: course.id, slug: course.slug, title: course.title, status: course.status },
      enrollment: enrollment
        ? { id: enrollment.id, status: enrollment.status, cycle: enrollment.cycle, lastLessonId: enrollment.lastLessonId }
        : null,
      lessons: course.lessons.map((l, i) => {
        const p = progress.find((x) => x.lessonId === l.id);
        return {
          id: l.id,
          order: l.order,
          title: l.title,
          description: l.description,
          durationSec: l.durationSec,
          videoStatus: l.videoStatus,
          isFreePreview: l.isFreePreview,
          attachmentUrls: states[i].unlocked ? l.attachmentUrls : [],
          unlocked: states[i].unlocked,
          completed: states[i].completed,
          watchedSec: p?.watchedSec ?? 0,
          lastPositionSec: p?.lastPositionSec ?? 0,
        };
      }),
      quiz: course.quiz
        ? {
            questionCount: course.quiz._count.questions,
            passPercent: course.quiz.passPercent,
            timeLimitMin: course.quiz.timeLimitMin,
            maxAttempts: course.quiz.maxAttempts,
            attemptsUsed,
            unlocked: !freeOnly && (preview || quizUnlocked(ids, done)),
          }
        : null,
    });
  }),
);

learningRouter.get(
  '/lessons/:id/play',
  ...auth,
  h(async (req, res) => {
    const user = req.user!;
    // The lesson and the learner's enrollment in its course, in one round of queries.
    const [lesson, enrollment] = await Promise.all([
      prisma.lesson.findUnique({ where: { id: req.params.id }, include: { course: true, renditions: true } }),
      prisma.enrollment.findFirst({ where: { userId: user.id, course: { lessons: { some: { id: req.params.id } } } } }),
    ]);
    if (!lesson) throw new AppError('NOT_FOUND', 404);
    const [, progress] = await Promise.all([
      enrollment
        ? assertLessonUnlocked(enrollment, lesson)
        : lesson.isFreePreview && lesson.course.status === 'PUBLISHED'
          ? Promise.resolve()
          : staffCanPreview(user.id, user.role, lesson.courseId).then((ok) => {
              if (!ok) throw new AppError('NOT_ENROLLED', 403);
            }),
      enrollment
        ? prisma.lessonProgress.findUnique({
            where: { enrollmentId_lessonId_cycle: { enrollmentId: enrollment.id, lessonId: lesson.id, cycle: enrollment.cycle } },
          })
        : null,
    ]);
    if (!lesson.bunnyVideoId || lesson.videoStatus !== 'READY') throw new AppError('NOT_FOUND', 404, 'Video is not ready yet');
    const allowed = allowedRenditions(lesson.sourceHeight, lesson.course.allow4k);
    const ready = lesson.renditions.filter((r) => r.ready).map((r) => r.height);
    const qualities = ready.length ? allowed.filter((hgt) => ready.includes(hgt)) : allowed;
    res.json({
      url: await video.getSignedPlaybackUrl(lesson.bunnyVideoId, PLAY_TTL_SEC),
      expiresAt: new Date(Date.now() + PLAY_TTL_SEC * 1000),
      qualities,
      resumeAt: progress && !progress.completed ? progress.lastPositionSec : progress?.lastPositionSec ?? 0,
      durationSec: lesson.durationSec,
    });
  }),
);

learningRouter.put(
  '/lessons/:id/progress',
  ...auth,
  h(async (req, res) => {
    const input = body(req, progressBody);
    // Sent every few seconds while a video plays: the lesson and the enrollment in its course in one round.
    const [lesson, enrollment] = await Promise.all([
      prisma.lesson.findUnique({ where: { id: req.params.id } }),
      prisma.enrollment.findFirst({ where: { userId: req.user!.id, course: { lessons: { some: { id: req.params.id } } } } }),
    ]);
    if (!lesson) throw new AppError('NOT_FOUND', 404);
    if (!enrollment) throw new AppError('NOT_ENROLLED', 403);
    const row = await recordProgress(enrollment, lesson, input);
    res.json({ watchedSec: row.watchedSec, lastPositionSec: row.lastPositionSec, completed: row.completed });
  }),
);
