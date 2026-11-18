// Essay grading (admins see everything; instructors use /instructor/grading).
//   GET  /admin/grading
//   GET  /admin/grading/:attemptId
//   POST /admin/grading/:attemptId  { grades: [{ questionId, points, comment? }] }
import { Router } from 'express';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { attemptForGrading, gradingQueue } from '../learning/learners.service.js';
import { gradeEssays } from '../quiz/grading.service.js';
import { gradeBody } from '../quiz/quiz.schemas.js';

export const gradingAdminRouter = Router();

gradingAdminRouter.get('/grading', h(async (_req, res) => res.json(await gradingQueue())));

gradingAdminRouter.get(
  '/grading/:attemptId',
  h(async (req, res) => {
    const a = await attemptForGrading(req.params.attemptId);
    if (!a) throw new AppError('NOT_FOUND', 404);
    res.json(a);
  }),
);

gradingAdminRouter.post(
  '/grading/:attemptId',
  h(async (req, res) => {
    const { grades } = body(req, gradeBody);
    const result = await gradeEssays(req.params.attemptId, grades);
    await writeAudit(req.user!.id, 'attempt.grade', 'QuizAttempt', req.params.attemptId, { grades, ...result });
    res.json(result);
  }),
);
