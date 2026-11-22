// API: site settings (bank details).
import { get, put } from '../client';
import type { BankDetails } from '@/types';

export const bankDetails = () => get<BankDetails>('/admin/settings/bank-details');
export const saveBankDetails = (b: { bankName: string; accountName: string; accountNumber: string; note?: string }) => put<BankDetails>('/admin/settings/bank-details', b);
