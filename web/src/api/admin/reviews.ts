// API: review moderation (spec 17).
import { api, get, patch } from '../client';
import type { Paged } from '@/types';

export interface AdminReview {
  id: string;
  rating: number;
  body: string;
  status: 'VISIBLE' | 'HIDDEN';
  hiddenReason: string | null;
  createdAt: string;
  updatedAt: string;
  course: { id: string; title: string; slug: string };
  user: { id: string; name: string; email: string };
}
export type ReviewQuery = { courseId?: string; status?: string; rating?: string | number; q?: string; page?: number };

export const list = (q: ReviewQuery) => get<Paged<AdminReview> & { hidden: number }>('/admin/reviews', q);
export const setStatus = (id: string, status: 'VISIBLE' | 'HIDDEN', reason?: string) => patch<AdminReview>(`/admin/reviews/${id}`, { status, reason });
export const remove = (id: string) => api<void>(`/admin/reviews/${id}`, { method: 'DELETE' });
