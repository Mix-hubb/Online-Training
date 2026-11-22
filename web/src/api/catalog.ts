// API: public catalog.
import { get } from './client';
import type { CourseCard, CourseDetail, Paged, Taxon } from '@/types';

export interface CourseQuery {
  q?: string;
  category?: string;
  level?: string;
  price?: 'free' | 'paid' | '';
  tag?: string;
  page?: number;
  pageSize?: number;
}
export const listCourses = (q: CourseQuery) => get<Paged<CourseCard>>('/courses', { ...q });
export const getCourse = (slug: string) => get<CourseDetail>(`/courses/${slug}`);
export const introVideo = (slug: string) => get<{ url: string }>(`/courses/${slug}/intro`);
export const categories = () => get<Taxon[]>('/categories');
export const tags = () => get<Taxon[]>('/tags');
