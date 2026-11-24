// API: course instructors (max 2) and each one's share of this course's sales.
import { del, get, patch, post } from '../client';
import type { Paged } from '@/types';

export interface CourseInstructorRow {
  courseId: string;
  userId: string;
  /** Share of this course's sales in basis points (3000 = 30%), paid before co-investors. */
  sharePercentBp: number;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}
export const list = (courseId: string) => get<CourseInstructorRow[]>(`/admin/courses/${courseId}/instructors`);
export const assign = (courseId: string, userId: string, sharePercentBp = 0) =>
  post<CourseInstructorRow[]>(`/admin/courses/${courseId}/instructors`, { userId, sharePercentBp });
export const setShare = (courseId: string, userId: string, sharePercentBp: number) =>
  patch<CourseInstructorRow[]>(`/admin/courses/${courseId}/instructors/${userId}`, { sharePercentBp });
export const unassign = (courseId: string, userId: string) => del<CourseInstructorRow[]>(`/admin/courses/${courseId}/instructors/${userId}`);
export const makeInstructor = (userId: string) => post(`/admin/users/${userId}/make-instructor`);
export const removeInstructor = (userId: string) => post(`/admin/users/${userId}/remove-instructor`);

// Admin "Instructors" page: instructor logins with the courses they teach and unpaid balance.
export interface InstructorRow {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'BANNED';
  mustChangePassword: boolean;
  createdAt: string;
  partnerId: string | null;
  courses: { id: string; title: string; slug: string; status: string; sharePercentBp: number }[];
  outstanding: { currency: string; amountMinor: number }[];
}
export interface CreatedInstructor {
  id: string;
  email: string;
  promoted: boolean;
  /** Shown once. null when an existing learner was promoted (they keep their password). */
  temporaryPassword: string | null;
}
export const listInstructors = (q: { q?: string; status?: string; page?: number }) => get<Paged<InstructorRow>>('/admin/instructors', q);
export const createInstructor = (b: { name: string; email: string; promoteExisting?: boolean }) => post<CreatedInstructor>('/admin/instructors', b);
export const resetInstructorPassword = (id: string) => post<{ email: string; temporaryPassword: string }>(`/admin/instructors/${id}/reset-password`);

// Instructor detail page (2026-11-24): one instructor, their assigned courses and earnings.
export interface InstructorCourse {
  id: string;
  title: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  thumbnailUrl: string | null;
  isFree: boolean;
  priceMinor: number;
  priceThbMinor: number | null;
  sharePercentBp: number;
  assignedAt: string;
  coInstructors: { id: string; name: string; sharePercentBp: number }[];
  learners: number;
  completed: number;
  rating: { average: number | null; count: number };
  earned: { currency: string; amountMinor: number }[];
}
export interface InstructorDetail {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'BANNED';
  mustChangePassword: boolean;
  createdAt: string;
  partnerId: string | null;
  courses: InstructorCourse[];
  earnings: { currency: string; earnedMinor: number; paidMinor: number; unpaidMinor: number }[];
  recent: {
    id: string;
    createdAt: string;
    courseId: string;
    courseTitle: string;
    currency: string;
    baseMinor: number;
    percentBp: number;
    amountMinor: number;
    status: 'PAID' | 'UNPAID';
  }[];
}
export const getInstructor = (id: string) => get<InstructorDetail>(`/admin/instructors/${id}`);
