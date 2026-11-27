// API: admin lessons + video upload.
import { del, get, patch, post, put } from '../client';
import { scope } from './scope';
import type { AdminLesson } from './courses';

export interface UploadTarget {
  providerVideoId: string;
  uploadUrl: string;
  uploadHeaders?: Record<string, string>;
}
export const create = (courseId: string, l: { title: string; description?: string | null }) => post<AdminLesson>(`${scope()}/courses/${courseId}/lessons`, l);
export const update = (id: string, l: Partial<{ title: string; description: string | null; attachmentUrls: string[]; durationSec: number; isFreePreview: boolean }>) => patch<AdminLesson>(`${scope()}/lessons/${id}`, l);
export const remove = (id: string) => del(`${scope()}/lessons/${id}`);
export const reorder = (courseId: string, ids: string[]) => put<{ ok: true }>(`${scope()}/courses/${courseId}/lessons/order`, { ids });
export const uploadInit = (id: string) => post<UploadTarget>(`${scope()}/lessons/${id}/upload-init`);
export const videoStatus = (id: string) =>
  get<{ status: 'NONE' | 'PROCESSING' | 'READY' | 'FAILED'; durationSec?: number; sourceHeight?: number; renditions?: number[] }>(`${scope()}/lessons/${id}/video-status`);
