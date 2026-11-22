// API: bank-transfer slip review.
import { get, post } from '../client';

export interface SlipRow {
  slipId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  url: string;
  order: {
    id: string;
    status: string;
    amountMinor: number;
    currency: string;
    createdAt: string;
    user: { id: string; name: string; email: string };
    course: { id: string; title: string };
  };
}
export const list = (status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING') => get<SlipRow[]>('/admin/payments/review', { status });
export const approve = (orderId: string) => post(`/admin/payments/${orderId}/approve`);
export const reject = (orderId: string, reason: string) => post(`/admin/payments/${orderId}/reject`, { reason });
