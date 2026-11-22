// API: checkout (Stripe card / PromptPay, Bitcoin) and bank transfer.
import { get, post } from './client';
import type { BankDetails, Currency, FileUpload, Order, PayMethod, Slip } from '@/types';

export const checkout = (courseId: string, method: Exclude<PayMethod, 'bank'>, currency: Currency) =>
  post<{ orderId: string; url: string }>(`/courses/${courseId}/checkout`, { method, currency });
export const bankDetails = () => get<BankDetails>('/payments/bank-details');
export const startBankTransfer = (courseId: string) => post<{ order: Order; bank: BankDetails }>(`/courses/${courseId}/checkout/bank-transfer`);
export const uploadSlip = (orderId: string, file: FileUpload) => post<{ id: string }>(`/orders/${orderId}/slip`, { file });
export const slips = (orderId: string) => get<Slip[]>(`/orders/${orderId}/slips`);
