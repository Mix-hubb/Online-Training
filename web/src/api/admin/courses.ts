// API: admin course CRUD.
import { del, get, patch, post, put } from '../client';
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

export const list = (q: { q?: string; status?: string; category?: string; page?: number }) => get<Paged<AdminCourseRow>>('/admin/courses', q);
export const getOne = (id: string) => get<AdminCourse>(`/admin/courses/${id}`);
export const create = (c: CourseInput) => post<AdminCourse>('/admin/courses', c);
export const update = (id: string, c: Partial<CourseInput>) => patch<AdminCourse>(`/admin/courses/${id}`, c);
export const setStatus = (id: string, status: CourseStatus) => post<AdminCourse>(`/admin/courses/${id}/status`, { status });
export const remove = (id: string) => del(`/admin/courses/${id}`);
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
export const introUploadInit = (id: string) => post<{ providerVideoId: string; uploadUrl: string; uploadHeaders?: Record<string, string> }>(`/admin/courses/${id}/intro-upload-init`);
