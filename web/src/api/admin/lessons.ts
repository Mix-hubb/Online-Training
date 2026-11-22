// API: admin lessons + video upload.
import { del, get, patch, post, put } from '../client';
import type { AdminLesson } from './courses';

export interface UploadTarget {
  providerVideoId: string;
  uploadUrl: string;
  uploadHeaders?: Record<string, string>;
}
export const create = (courseId: string, l: { title: string; description?: string | null }) => post<AdminLesson>(`/admin/courses/${courseId}/lessons`, l);
export const update = (id: string, l: Partial<{ title: string; description: string | null; attachmentUrls: string[]; durationSec: number }>) => patch<AdminLesson>(`/admin/lessons/${id}`, l);
export const remove = (id: string) => del(`/admin/lessons/${id}`);
export const reorder = (courseId: string, ids: string[]) => put<AdminLesson[]>(`/admin/courses/${courseId}/lessons/order`, { ids });
export const uploadInit = (id: string) => post<UploadTarget>(`/admin/lessons/${id}/upload-init`);
export const videoStatus = (id: string) =>
  get<{ status: 'NONE' | 'PROCESSING' | 'READY' | 'FAILED'; durationSec?: number; sourceHeight?: number; renditions?: number[] }>(`/admin/lessons/${id}/video-status`);
