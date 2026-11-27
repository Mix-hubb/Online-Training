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
  owner: { id: string; name: string } | null;
  /** true: I made this course (I edit details, price, team and send it for review). */
  isOwner: boolean;
  /** Admin's note when the course was sent back from review. */
  reviewNote: string | null;
  submittedAt: string | null;
  updatedAt: string;
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
