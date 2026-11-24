// Private image uploads (chat + payment slips). Spec 15.4 / 15.6.
// Files arrive as base64 in JSON: { name, dataBase64 }. The type is checked by magic bytes, never by the sent mime.
import crypto from 'node:crypto';
import { z } from 'zod';
import { AppError } from './errors.js';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Admin site images (banner, cover...): high-resolution photos are often over 5 MB (2026-11-24). */
export const MAX_ADMIN_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 3;

export const fileInput = z.object({
  name: z.string().max(200).optional(),
  dataBase64: z.string().min(1),
});
export type FileInput = z.infer<typeof fileInput>;

export interface CheckedImage {
  buffer: Buffer;
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  ext: 'jpg' | 'png' | 'webp';
  width?: number;
  height?: number;
}

export function sniffImage(buf: Buffer): Omit<CheckedImage, 'buffer'> | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg', ...jpegSize(buf) };
  }
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length >= 24 && buf.subarray(0, 8).equals(png)) {
    return { mime: 'image/png', ext: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

function jpegSize(buf: Buffer): { width?: number; height?: number } {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return {};
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return {};
}

export function decodeImage(file: FileInput, maxBytes = MAX_FILE_BYTES): CheckedImage {
  const b64 = file.dataBase64.replace(/^data:[^;]+;base64,/, '');
  if (Math.floor((b64.length * 3) / 4) > maxBytes + 3) throw new AppError('ATTACHMENT_TOO_LARGE', 413);
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length > maxBytes) throw new AppError('ATTACHMENT_TOO_LARGE', 413);
  const info = sniffImage(buffer);
  if (!info) throw new AppError('UNSUPPORTED_FILE_TYPE', 415, 'Only JPG, PNG or WebP images');
  return { buffer, ...info };
}

export function decodeImages(files: FileInput[]): CheckedImage[] {
  if (files.length > MAX_FILES_PER_MESSAGE) throw new AppError('TOO_MANY_ATTACHMENTS', 400);
  return files.map((f) => decodeImage(f));
}

export const privateKey = (prefix: string, ext: string) => `${prefix}/${crypto.randomUUID()}.${ext}`;
