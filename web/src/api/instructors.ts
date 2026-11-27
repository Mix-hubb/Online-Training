// API: instructor sign-up, own profile and documents, course team, and the public instructor directory (2026-11-27).
import { del, get, patch, post, put } from './client';
import type { FileUpload, InstructorCard, InstructorDoc, InstructorProfile, Paged, PublicInstructor } from '@/types';

export interface ProfileFields {
  phone: string;
  headline: string;
  bio: string;
  expertise: string[];
}
export interface DocUpload {
  title: string;
  isPublic: boolean;
  file: FileUpload;
}

/** Each document: PDF, JPG, PNG or WebP, up to 5 MB. Must match api/src/modules/instructor/profile.service.ts. */
export const MAX_DOC_MB = 5;
export const MAX_DOCS = 8;
/** The sign-up request carries every file; keep it under the API's 25 MB upload body. */
export const MAX_SIGNUP_MB = 18;

export const register = (input: ProfileFields & { name: string; email: string; password: string; documents: DocUpload[] }) =>
  post<{ ok: true; email: string; mailSent: boolean }>('/auth/register-instructor', input);

export const myProfile = () => get<InstructorProfile>('/instructor/profile');
export const saveProfile = (p: ProfileFields) => put<InstructorProfile>('/instructor/profile', p);
export const addDocument = (d: DocUpload) => post<InstructorProfile>('/instructor/profile/documents', d);
export const updateDocument = (id: string, d: { title?: string; isPublic?: boolean }) =>
  patch<InstructorProfile>(`/instructor/profile/documents/${id}`, d);
export const removeDocument = (id: string) => del<InstructorProfile>(`/instructor/profile/documents/${id}`);

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  owner: boolean;
  addedAt: string;
}
export const team = (courseId: string) => get<TeamMember[]>(`/instructor/courses/${courseId}/team`);
export const addToTeam = (courseId: string, email: string) => post<TeamMember[]>(`/instructor/courses/${courseId}/team`, { email });
export const removeFromTeam = (courseId: string, userId: string) => del<TeamMember[]>(`/instructor/courses/${courseId}/team/${userId}`);

// Public directory (no sign-in)
export const list = (q: { q?: string; page?: number } = {}) => get<Paged<InstructorCard>>('/instructors', q);
export const getOne = (id: string) => get<PublicInstructor>(`/instructors/${id}`);

export type { InstructorDoc };
