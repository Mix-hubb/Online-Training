// API: admin users.
import { get, post } from '../client';
import type { MyCourse, Order, Paged, Role } from '@/types';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  status: 'ACTIVE' | 'BANNED';
  emailVerifiedAt: string | null;
  createdAt: string;
  _count?: { enrollments: number };
}
export const list = (q: { q?: string; status?: string; role?: string; roles?: string; page?: number }) => get<Paged<UserRow>>('/admin/users', q);
export const detail = (id: string) => get<{ user: UserRow; courses: MyCourse[]; orders: (Order & { course: { title: string } })[]; partner: { id: string; name: string } | null }>(`/admin/users/${id}`);
export const ban = (id: string) => post(`/admin/users/${id}/ban`);
export const unban = (id: string) => post(`/admin/users/${id}/unban`);
