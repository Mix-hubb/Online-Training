// API: course CRUD. Admins (review, older courses) and instructors (their own courses) share it; see scope.ts.
import { del, get, patch, post, put } from '../client';
import { scope } from './scope';
import type { CourseStatus, Level, Paged, Taxon } from '@/types';

export interface AdminCourseRow {
  id: string;
  slug: string;
  title: string;
  status: CourseStatus;
  isFree: boolean;
  priceMinor: number;
  priceThbMinor: number | null;
  thumbnailUrl: string | null;
  category: string | null;
  lessons: number;
  learners: number;
  updatedAt: string;
  pinOrder: number | null;
  owner: { id: string; name: string; email: string } | null;
  submittedAt: string | null;
}

export interface AdminLesson {
  id: string;
  order: number;
  title: string;
  description: string | null;
  bunnyVideoId: string | null;
  videoStatus: 'PROCESSING' | 'READY' | 'FAILED';
  durationSec: number;
  sourceHeight: number | null;
  attachmentUrls: string[];
  isFreePreview: boolean;
  renditions: { height: number; ready: boolean }[];
}

export interface AdminQuestion {
  id: string;
  order: number;
  type: 'MCQ' | 'ESSAY';
  text: string;
  points: number;
  options: { id: string; text: string; isCorrect: boolean }[];
}

export interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  outcomes: string[];
  thumbnailUrl: string | null;
  introVideoId: string | null;
  level: Level;
  status: CourseStatus;
  isFree: boolean;
  priceMinor: number;
  priceThbMinor: number | null;
  allow4k: boolean;
  categoryId: string | null;
  category: Taxon | null;
  tags: Taxon[];
  lessons: AdminLesson[];
  quiz: { id: string; passPercent: number; timeLimitMin: number | null; maxAttempts: number; questions: AdminQuestion[] } | null;
  instructors: { userId: string; user: { id: string; name: string; email: string } }[];
  ownerId: string | null;
  owner: { id: string; name: string; email: string } | null;
  submittedAt: string | null;
  reviewNote: string | null;
  _count: { enrollments: number; orders: number };
}

export interface CourseInput {
  title: string;
  summary?: string;
  description?: string;
  outcomes?: string[];
  thumbnailUrl?: string | null;
  level?: Level;
  categoryId?: string | null;
  tagIds?: string[];
  isFree?: boolean;
  priceMinor?: number;
  priceThbMinor?: number | null;
  allow4k?: boolean;
}

export const list = (q: { q?: string; status?: string; category?: string; page?: number }) => get<Paged<AdminCourseRow>>(`${scope()}/courses`, q);
export const getOne = (id: string) => get<AdminCourse>(`${scope()}/courses/${id}`);
export const create = (c: CourseInput) => post<AdminCourse>(`${scope()}/courses`, c);
export const update = (id: string, c: Partial<CourseInput>) => patch<AdminCourse>(`${scope()}/courses/${id}`, c);
export const setStatus = (id: string, status: CourseStatus) => post<AdminCourse>(`${scope()}/courses/${id}/status`, { status });
export const remove = (id: string) => del(`${scope()}/courses/${id}`);
// Admin pins (no limit, PUBLISHED only). Pinned courses list first for learners, by pinOrder.
export interface PinnedCourse {
  id: string;
  slug: string;
  title: string;
  status: CourseStatus;
  thumbnailUrl: string | null;
  pinOrder: number;
}
export const pins = () => get<PinnedCourse[]>('/admin/courses/pins');
export const pin = (id: string) => post<PinnedCourse[]>(`/admin/courses/${id}/pin`);
export const unpin = (id: string) => del<PinnedCourse[]>(`/admin/courses/${id}/pin`);
export const reorderPins = (ids: string[]) => put<PinnedCourse[]>('/admin/courses/pins', { ids });
// Admin review of instructor courses (IN_REVIEW -> PUBLISHED, or back to DRAFT with a note).
export const approve = (id: string) => post<AdminCourse>(`/admin/courses/${id}/approve`);
export const reject = (id: string, reason: string) => post<AdminCourse>(`/admin/courses/${id}/reject`, { reason });
export const introUploadInit = (id: string) => post<{ providerVideoId: string; uploadUrl: string; uploadHeaders?: Record<string, string> }>(`${scope()}/courses/${id}/intro-upload-init`);
