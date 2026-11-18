// Final test for learners (requireAuth).
//   GET  /courses/:id/quiz          (intro: settings, lock, attempts left, history)
//   POST /courses/:id/quiz/start    (QUIZ_LOCKED / NO_ATTEMPTS_LEFT; attempts counted per cycle; resumes an open attempt)
//   GET  /attempts/:id              (review fields ONLY if the learner has passed)
//   PUT  /attempts/:id/answers      (save draft answers; ATTEMPT_EXPIRED after the time limit)
//   POST /attempts/:id/submit       { answers? }
import { Router } from 'express';
import { h } from '../../lib/async.js';
import { body } from '../../lib/validate.js';
import { requireAuth, requireLearner } from '../../middleware/auth.js';
import { answersBody } from './quiz.schemas.js';
import { quizOverview, saveAnswers, startAttempt, submitAttempt, viewAttempt } from './attempt.service.js';

export const quizRouter = Router();
const auth = [requireAuth, requireLearner];

quizRouter.get('/courses/:id/quiz', ...auth, h(async (req, res) => res.json(await quizOverview(req.user!.id, req.params.id))));
quizRouter.post('/courses/:id/quiz/start', ...auth, h(async (req, res) => res.status(201).json(await startAttempt(req.user!.id, req.params.id))));
quizRouter.get('/attempts/:id', ...auth, h(async (req, res) => res.json(await viewAttempt(req.user!.id, req.params.id))));

quizRouter.put(
  '/attempts/:id/answers',
  ...auth,
  h(async (req, res) => res.json(await saveAnswers(req.user!.id, req.params.id, body(req, answersBody).answers))),
);

quizRouter.post(
  '/attempts/:id/submit',
  ...auth,
  h(async (req, res) => {
    const input = body(req, answersBody.partial());
    const { late } = await submitAttempt(req.user!.id, req.params.id, input.answers);
    res.json({ late, attempt: await viewAttempt(req.user!.id, req.params.id) });
  }),
);
