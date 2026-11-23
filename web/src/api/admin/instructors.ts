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
