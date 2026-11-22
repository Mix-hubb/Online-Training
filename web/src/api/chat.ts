// API: private chat (learner + staff share the thread endpoints).
import { get, post } from './client';
import type { ChatMessage, FileUpload, ThreadDetail, ThreadSummary } from '@/types';

export interface MessageInput {
  body: string;
  attachments: FileUpload[];
}
export const myThreads = () => get<ThreadSummary[]>('/me/threads');
export const openSupport = (subject: string, m: MessageInput) => post<{ id: string }>('/me/threads/support', { subject, ...m });
export const openCourseThread = (courseId: string, subject: string, m: MessageInput) => post<{ id: string }>(`/courses/${courseId}/threads`, { subject, ...m });
export const messages = (threadId: string) => get<ThreadDetail>(`/threads/${threadId}/messages`);
export const send = (threadId: string, m: MessageInput) => post<ChatMessage>(`/threads/${threadId}/messages`, m);
export const markRead = (threadId: string) => post(`/threads/${threadId}/read`);
export const close = (threadId: string) => post(`/threads/${threadId}/close`);
export const attachmentUrl = (id: string) => get<{ url: string; expiresInSec: number }>(`/attachments/${id}/url`);
export const adminThreads = (q: { type?: string; status?: string; unread?: string } = {}) => get<ThreadSummary[]>('/admin/threads', q);
export const instructorThreads = (q: { status?: string } = {}) => get<ThreadSummary[]>('/instructor/threads', q);
