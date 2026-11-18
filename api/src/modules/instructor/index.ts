// Instructor router mounted at /instructor: requireAuth + requireInstructor; course routes also check the assignment.
// Instructors can NOT edit course content (spec 15.2): there are no write routes for courses, lessons or the test here.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInstructor } from '../../middleware/roles.js';
import { instructorCoursesRouter } from './courses.routes.js';
import { instructorGradingRouter } from './grading.routes.js';
import { instructorChatRouter } from './chat.routes.js';
import { instructorEarningsRouter } from './earnings.routes.js';

export const instructorRouter = Router();

instructorRouter.use(requireAuth, requireInstructor);
instructorRouter.use(instructorCoursesRouter, instructorGradingRouter, instructorChatRouter, instructorEarningsRouter);
