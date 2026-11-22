// API: course instructors (max 2) and each one's share of this course's sales.
import { del, get, patch, post } from '../client';

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
