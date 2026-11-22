// API: admin grading + shared learner/grading types.
import { get, post } from '../client';

export interface GradingRow {
  attemptId: string;
  submittedAt: string;
  learner: { id: string; name: string; email: string };
  course: { id: string; title: string };
  cycle: number;
}

export interface GradingAttempt {
  id: string;
  status: string;
  cycle: number;
  submittedAt: string | null;
  answers: { questionId: string; optionId: string | null; essayText: string | null; pointsAwarded: number | null; adminComment: string | null }[];
  enrollment: { user: { id: string; name: string; email: string } };
  quiz: {
    passPercent: number;
    course: { id: string; title: string };
    questions: { id: string; order: number; type: 'MCQ' | 'ESSAY'; text: string; points: number; options: { id: string; text: string; isCorrect: boolean }[] }[];
  };
}

export interface LearnerRow {
  enrollmentId: string;
  learner: { id: string; name: string; email: string; avatarUrl: string | null };
  enrolledAt: string;
  status: string;
  cycle: number;
  completedLessons: number;
  totalLessons: number;
  percent: number;
  lastActivity: string;
  attemptsThisCycle: number;
  lastAttempt: { id: string; status: string; score: number | null; maxScore: number | null; passed: boolean | null } | null;
  certificate: string | null;
}

export const queue = () => get<GradingRow[]>('/admin/grading');
export const attempt = (id: string) => get<GradingAttempt>(`/admin/grading/${id}`);
export const grade = (id: string, grades: { questionId: string; points: number; comment?: string }[]) =>
  post<{ score: number; maxScore: number; passed: boolean }>(`/admin/grading/${id}`, { grades });
export const learners = (courseId: string) => get<LearnerRow[]>(`/admin/courses/${courseId}/learners`);
