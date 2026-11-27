// Instructor router mounted at /instructor: requireAuth + requireInstructor; course routes also check the assignment.
// 2026-11-27: instructors create and run their own courses. The admin course, lesson and quiz routers are mounted
// here too; each handler checks access (modules/courses/access.ts). Admins only review and approve.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireApprovedInstructor, requireInstructor } from '../../middleware/roles.js';
import { instructorProfileRouter } from './profile.routes.js';
import { instructorCoursesRouter } from './courses.routes.js';
import { instructorGradingRouter } from './grading.routes.js';
import { instructorChatRouter } from './chat.routes.js';
import { instructorEarningsRouter } from './earnings.routes.js';
import { quizAdminRouter } from '../admin/quiz.routes.js';
import { coursesAdminRouter } from '../admin/courses.routes.js';
import { lessonsAdminRouter } from '../admin/lessons.routes.js';
import { instructorTeamRouter } from './team.routes.js';

export const instructorRouter = Router();

instructorRouter.use(requireAuth, requireInstructor);
// Own profile / application: open in every status. Everything after it needs an approved profile (2026-11-27).
instructorRouter.use(instructorProfileRouter);
instructorRouter.use(requireApprovedInstructor);
// instructorCoursesRouter first: its GET /courses (my courses with status) wins over the shared admin list.
instructorRouter.use(
  instructorCoursesRouter,
  instructorGradingRouter,
  instructorChatRouter,
  instructorEarningsRouter,
  instructorTeamRouter,
  coursesAdminRouter,
  lessonsAdminRouter,
  quizAdminRouter,
);
