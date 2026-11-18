// File storage interface.
// Public files: cover, banner, partner logo, certificate logo/signature (CDN URL).
// Private files: chat attachments, payment slips, certificate PDFs (signed, short-lived URL only).
export interface FileStorage {
  /** Stores a public file and returns its public URL. */
  putPublic(key: string, body: Buffer, contentType: string): Promise<string>;
  /** Stores a private file. It is never reachable without a signed URL. */
  putPrivate(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Short-lived URL for a private file. Call only after the access check passed. */
  signedUrl(key: string, ttlSec: number): Promise<string>;
  delete(key: string, visibility: 'public' | 'private'): Promise<void>;
}
