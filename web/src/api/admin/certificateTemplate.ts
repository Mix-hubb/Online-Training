// API: certificate template.
import { API_BASE, get, put } from '../client';

export interface CertificateTemplate {
  heading: string;
  issuerName: string;
  signerName: string;
  signerTitle: string;
  logoUrl: string | null;
  signatureUrl: string | null;
  primaryColor: string;
}
export const getTemplate = () => get<CertificateTemplate>('/admin/certificate-template');
export const saveTemplate = (t: CertificateTemplate) => put<CertificateTemplate>('/admin/certificate-template', t);
export const previewUrl = () => `${API_BASE}/admin/certificate-template/preview.pdf?t=${Date.now()}`;
