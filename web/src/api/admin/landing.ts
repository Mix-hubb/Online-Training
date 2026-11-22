// API: admin landing CMS + image upload.
import { del, get, patch, post, put } from '../client';
import type { FileUpload } from '@/types';

export interface Banner {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
  altText: string | null;
  order: number;
  isActive: boolean;
}
export interface Section {
  key: string;
  content: Record<string, unknown>;
  isVisible: boolean;
  order: number;
}
export const banners = () => get<Banner[]>('/admin/banners');
export const addBanner = (b: Partial<Banner>) => post<Banner>('/admin/banners', b);
export const updateBanner = (id: string, b: Partial<Banner>) => patch<Banner>(`/admin/banners/${id}`, b);
export const removeBanner = (id: string) => del(`/admin/banners/${id}`);
export const reorderBanners = (ids: string[]) => put<Banner[]>('/admin/banners/order', { ids });
export const sections = () => get<Section[]>('/admin/landing');
export const saveSections = (sections: Section[]) => put<Section[]>('/admin/landing', { sections });
export const uploadImage = (file: FileUpload, kind: 'cover' | 'banner' | 'logo' | 'signature' | 'other') =>
  post<{ url: string; width?: number; height?: number }>('/admin/uploads', { file, kind });
