// API: categories and tags.
import { del, get, patch, post } from '../client';

export interface TaxonRow {
  id: string;
  name: string;
  slug: string;
  _count: { courses: number };
}
export const categories = () => get<TaxonRow[]>('/admin/categories');
export const addCategory = (name: string) => post('/admin/categories', { name });
export const renameCategory = (id: string, name: string) => patch(`/admin/categories/${id}`, { name });
export const removeCategory = (id: string) => del(`/admin/categories/${id}`);
export const tags = () => get<TaxonRow[]>('/admin/tags');
export const addTag = (name: string) => post('/admin/tags', { name });
export const renameTag = (id: string, name: string) => patch(`/admin/tags/${id}`, { name });
export const removeTag = (id: string) => del(`/admin/tags/${id}`);
