// API: instructor area (assigned courses only).
import { download, get, post } from './client';
import type { Payout, RevenueRow, RevenueTotals } from '@/types';
import type { GradingAttempt, GradingRow, LearnerRow } from './admin/grading';

export interface InstructorCourse {
  id: string;
  slug: string;
  title: string;
  status: string;
  thumbnailUrl: string | null;
  learners: number;
  lessons: number;
}
export const dashboard = () =>
  get<{ courses: InstructorCourse[]; learners: number; gradingWaiting: number; unreadThreads: number }>('/instructor/dashboard');
export const courses = () => get<InstructorCourse[]>('/instructor/courses');
export const learners = (courseId: string) => get<LearnerRow[]>(`/instructor/courses/${courseId}/learners`);
export const gradingQueue = () => get<GradingRow[]>('/instructor/grading');
export const gradingAttempt = (id: string) => get<GradingAttempt>(`/instructor/grading/${id}`);
export const grade = (id: string, grades: { questionId: string; points: number; comment?: string }[]) =>
  post<{ score: number; maxScore: number; passed: boolean }>(`/instructor/grading/${id}`, { grades });
export const earnings = () =>
  get<
    | { linked: false }
    | {
        linked: true;
        partner: { id: string; name: string };
        totals: RevenueTotals;
        sharePercentBp: number;
        /** Current share of each assigned course, basis points. Old entries keep the percent used at payment time. */
        courseShares: { id: string; title: string; slug: string; sharePercentBp: number }[];
        courses: { id: string; title: string; slug: string }[];
        rows: RevenueRow[];
        payouts: Payout[];
      }
  >('/instructor/earnings');
export const earningsCsv = () => download('/instructor/earnings.csv', 'earnings.csv');
