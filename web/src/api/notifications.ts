// API: in-app notifications.
import { get, post } from './client';
import type { AppNotification } from '@/types';

export const list = () => get<{ items: AppNotification[]; unread: number }>('/notifications');
export const read = (id: string) => post(`/notifications/${id}/read`);
export const readAll = () => post('/notifications/read-all');
