// API: course instructors (max 2).
import { del, get, post } from '../client';

export interface CourseInstructorRow {
  courseId: string;
  userId: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}
export const list = (courseId: string) => get<CourseInstructorRow[]>(`/admin/courses/${courseId}/instructors`);
export const assign = (courseId: string, userId: string) => post<CourseInstructorRow[]>(`/admin/courses/${courseId}/instructors`, { userId });
export const unassign = (courseId: string, userId: string) => del<CourseInstructorRow[]>(`/admin/courses/${courseId}/instructors/${userId}`);
export const makeInstructor = (userId: string) => post(`/admin/users/${userId}/make-instructor`);
export const removeInstructor = (userId: string) => post(`/admin/users/${userId}/remove-instructor`);
