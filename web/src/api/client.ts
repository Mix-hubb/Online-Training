// fetch wrapper: base URL from VITE_API_URL, credentials: 'include' (cookie JWT),
// parses { error: { code } } into ApiError so pages can switch on stable codes.
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** VITE_API_URL without "https://" would be read as a path on the web site itself (which answers every path
 *  with index.html), so a bare host gets https:// added; a trailing slash is dropped. */
function apiBase(raw: string | undefined): string {
  const v = (raw ?? '').trim().replace(/\/+$/, '');
  if (!v) return 'http://localhost:4000';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
export const API_BASE = apiBase(import.meta.env.VITE_API_URL as string | undefined);

type Query = Record<string, string | number | boolean | null | undefined>;

export function qs(q?: Query): string {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Called on MUST_CHANGE_PASSWORD / UNAUTHENTICATED so the app can react (set in main.ts). */
export const apiHooks: { onAuthError?: (code: string) => void } = {};

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = body?.error?.code ?? 'INTERNAL';
    if (code === 'MUST_CHANGE_PASSWORD' || code === 'BANNED') apiHooks.onAuthError?.(code);
    throw new ApiError(code, res.status, body?.error?.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  // An HTML page means the request reached the web site, not the api: VITE_API_URL is wrong.
  if (type.includes('text/html')) {
    console.error(`API_URL_WRONG: ${API_BASE}${path} returned a web page. Check VITE_API_URL on the web service and redeploy it.`);
    throw new ApiError('API_URL_WRONG', res.status, 'The site cannot reach its server. Please try again later.');
  }
  return (type.includes('application/json') ? await res.json() : await res.text()) as T;
}

export const get = <T>(path: string, q?: Query) => api<T>(`${path}${qs(q)}`);
export const post = <T>(path: string, json: unknown = {}) => api<T>(path, { method: 'POST', json });
export const put = <T>(path: string, json: unknown = {}) => api<T>(path, { method: 'PUT', json });
export const patch = <T>(path: string, json: unknown = {}) => api<T>(path, { method: 'PATCH', json });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

/** Downloads a file response (PDF, CSV) with the session cookie. */
export async function download(path: string, filename: string) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!res.ok) throw new ApiError('INTERNAL', res.status, 'Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads a File as base64 (no data: prefix) for JSON uploads. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^;]+;base64,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message && e.message !== e.code ? e.message : e.code.replace(/_/g, ' ').toLowerCase();
  return 'Something went wrong. Please try again.';
}
