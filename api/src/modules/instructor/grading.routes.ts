// Essay grading for assigned courses only.
//   GET  /instructor/grading
//   GET  /instructor/grading/:attemptId
//   POST /instructor/grading/:attemptId  { grades: [{ questionId, points, comment? }] }
import { Router } from 'express';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body } from '../../lib/validate.js';
import { isAssigned } from '../../middleware/roles.js';
import { attemptForGrading, gradingQueue } from '../learning/learners.service.js';
import { gradeEssays } from '../quiz/grading.service.js';
import { gradeBody } from '../quiz/quiz.schemas.js';
import { myCourseIds } from './courses.routes.js';

export const instructorGradingRouter = Router();

async function loadAssignedAttempt(userId: string, role: string, attemptId: string) {
  const a = await attemptForGrading(attemptId);
  if (!a) throw new AppError('NOT_FOUND', 404);
  if (role !== 'ADMIN' && !(await isAssigned(userId, a.quiz.courseId))) throw new AppError('NOT_ASSIGNED', 403);
  return a;
}

instructorGradingRouter.get('/grading', h(async (req, res) => res.json(await gradingQueue(await myCourseIds(req.user!.id)))));

instructorGradingRouter.get(
  '/grading/:attemptId',
  h(async (req, res) => res.json(await loadAssignedAttempt(req.user!.id, req.user!.role, req.params.attemptId))),
);

instructorGradingRouter.post(
  '/grading/:attemptId',
  h(async (req, res) => {
    await loadAssignedAttempt(req.user!.id, req.user!.role, req.params.attemptId);
    res.json(await gradeEssays(req.params.attemptId, body(req, gradeBody).grades));
  }),
);
