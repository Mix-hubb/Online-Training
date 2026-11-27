// My courses: owned (created by me) and co-taught (2026-11-27; editing lives in the shared admin routers).
//   GET /instructor/dashboard
//   GET /instructor/courses
//   GET /instructor/courses/:courseId/learners  (progress, test status, cycle)
import { Router } from 'express';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { requireCourseAssignment } from '../../middleware/roles.js';
import { courseLearners, gradingQueue } from '../learning/learners.service.js';

export const instructorCoursesRouter = Router();

export async function myCourseIds(userId: string) {
  const rows = await prisma.courseInstructor.findMany({ where: { userId }, select: { courseId: true } });
  return rows.map((r) => r.courseId);
}

async function myCourses(userId: string) {
  const ids = await myCourseIds(userId);
  const courses = await prisma.course.findMany({
    where: { id: { in: ids } },
    include: { _count: { select: { enrollments: true, lessons: true } }, owner: { select: { id: true, name: true } } },
    orderBy: { title: 'asc' },
  });
  return courses.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    status: c.status,
    thumbnailUrl: c.thumbnailUrl,
    learners: c._count.enrollments,
    lessons: c._count.lessons,
    owner: c.owner,
    isOwner: c.ownerId === userId,
    reviewNote: c.reviewNote,
    submittedAt: c.submittedAt,
    updatedAt: c.updatedAt,
  }));
}

instructorCoursesRouter.get(
  '/dashboard',
  h(async (req, res) => {
    const userId = req.user!.id;
    const ids = await myCourseIds(userId);
    const [courses, queue, threads] = await Promise.all([
      myCourses(userId),
      gradingQueue(ids),
      prisma.supportThread.findMany({ where: { type: 'COURSE', courseId: { in: ids }, status: 'OPEN' }, select: { lastMessageAt: true, staffReadAt: true } }),
    ]);
    res.json({
      courses,
      learners: courses.reduce((s, c) => s + c.learners, 0),
      gradingWaiting: queue.length,
      unreadThreads: threads.filter((t) => !t.staffReadAt || t.lastMessageAt > t.staffReadAt).length,
    });
  }),
);

instructorCoursesRouter.get('/courses', h(async (req, res) => res.json(await myCourses(req.user!.id))));

instructorCoursesRouter.get(
  '/courses/:courseId/learners',
  requireCourseAssignment('courseId'),
  h(async (req, res) => res.json(await courseLearners(req.params.courseId))),
);
