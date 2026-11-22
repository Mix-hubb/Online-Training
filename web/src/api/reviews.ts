// API: course reviews (spec 17). Public list + the learner's own review.
import { api, get, put } from './client';

export interface RatingSummary {
  average: number | null;
  count: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}
export interface PublicReview {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  edited: boolean;
  author: string;
}
export interface ReviewList {
  summary: RatingSummary;
  items: PublicReview[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
export interface MyReview {
  id: string;
  rating: number;
  body: string;
  status: 'VISIBLE' | 'HIDDEN';
  createdAt: string;
  updatedAt: string;
}

export const list = (slug: string, page = 1, pageSize = 5) => get<ReviewList>(`/courses/${slug}/reviews`, { page, pageSize });
export const mine = (courseId: string) => get<{ canReview: boolean; review: MyReview | null }>(`/me/courses/${courseId}/review`);
export const save = (courseId: string, input: { rating: number; body: string }) => put<MyReview>(`/me/courses/${courseId}/review`, input);
export const remove = (courseId: string) => api<void>(`/me/courses/${courseId}/review`, { method: 'DELETE' });
