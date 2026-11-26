// API: certificate template.
import { API_BASE, ApiError, get, put } from '../client';

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
/**
 * The preview PDF as a local blob: URL (2026-11-26). An <iframe> pointing straight at the API does not work in
 * production: the web and the API are on different sites, so the API's X-Frame-Options: SAMEORIGIN refuses the
 * frame, and browsers that block third-party cookies send no session (401). fetch() is a normal CORS call with
 * the session cookie, like file downloads. The caller revokes the old URL with URL.revokeObjectURL.
 */
export async function previewBlobUrl(): Promise<string> {
  const res = await fetch(`${API_BASE}/admin/certificate-template/preview.pdf?t=${Date.now()}`, { credentials: 'include' });
  if (!res.ok) throw new ApiError('INTERNAL', res.status, 'The preview could not be loaded');
  return URL.createObjectURL(await res.blob());
}
