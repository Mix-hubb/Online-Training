// API: partners (co-investors + instructors with a share), partner logins.
import { del, get, patch, post, put } from '../client';
import type { FileUpload } from '@/types';

export interface PartnerRow {
  id: string;
  name: string;
  contact: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  showLogo: boolean;
  logoOrder: number;
  userId: string | null;
  kind: 'CO_INVESTOR' | 'INSTRUCTOR';
  user: { id: string; email: string; role: string; status: string; mustChangePassword: boolean } | null;
  /** Share of TOTAL revenue (all courses), basis points: 2500 = 25%. */
  sharePercentBp: number;
  outstanding: { currency: string; amountMinor: number }[];
}
export interface PartnerInput {
  name: string;
  contact?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  showLogo?: boolean;
  userId?: string | null;
  sharePercentBp?: number;
}
export const list = () => get<PartnerRow[]>('/admin/partners');
export const create = (p: PartnerInput) => post<PartnerRow>('/admin/partners', p);
export const update = (id: string, p: Partial<PartnerInput>) => patch<PartnerRow>(`/admin/partners/${id}`, p);
export const remove = (id: string) => del(`/admin/partners/${id}`);
export const uploadLogo = (id: string, file: FileUpload) => post<PartnerRow>(`/admin/partners/${id}/logo`, { file });
export const logoOrder = (ids: string[]) => put<PartnerRow[]>('/admin/partners/logo-order', { ids });
export const createAccount = (id: string, email: string) => post<{ email: string; temporaryPassword: string }>(`/admin/partners/${id}/account`, { email });
export const resetPassword = (id: string) => post<{ email: string; temporaryPassword: string }>(`/admin/partners/${id}/account/reset-password`);
