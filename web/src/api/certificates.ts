// API: certificates.
import { download, get } from './client';
import type { CertificateVerify } from '@/types';

export const verify = (number: string) => get<CertificateVerify>(`/certificates/${number}`);
export const mine = () => get<{ id: string; number: string; issuedAt: string; course: { title: string; slug: string } }[]>('/me/certificates');
export const downloadPdf = (id: string, number: string) => download(`/me/certificates/${id}/pdf`, `${number}.pdf`);
