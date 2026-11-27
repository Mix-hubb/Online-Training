// Instructor profile + qualification documents (2026-11-27).
// Documents are PDF or images, max 5 MB each, at most MAX_DOCS per instructor, stored in PRIVATE storage.
// Images are re-encoded (EXIF/GPS dropped); PDFs are stored as sent after a magic-byte check.
import { z } from 'zod';
import type { InstructorDocument, InstructorProfile } from '@prisma/client';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { fileInput, privateKey, sniffImage, MAX_FILE_BYTES, type FileInput } from '../../lib/attachments.js';
import { optimizeImage } from '../../lib/images.js';
import { storage } from '../../providers/storage/index.js';

export const MAX_DOCS = 8;
const DOC_URL_TTL = 600;

export const profileFields = z.object({
  phone: z.string().trim().min(6).max(30),
  headline: z.string().trim().min(1).max(120),
  bio: z.string().trim().min(1).max(3000),
  expertise: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
});

export const documentInput = z.object({
  title: z.string().trim().min(1).max(120),
  isPublic: z.boolean().default(false),
  file: fileInput,
});
export type DocumentInput = z.infer<typeof documentInput>;

/** PDF or JPG/PNG/WebP by magic bytes. */
async function decodeDocument(file: FileInput) {
  const b64 = file.dataBase64.replace(/^data:[^;]+;base64,/, '');
  if (Math.floor((b64.length * 3) / 4) > MAX_FILE_BYTES + 3) throw new AppError('ATTACHMENT_TOO_LARGE', 413, 'Each document must be 5 MB or smaller');
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length > MAX_FILE_BYTES) throw new AppError('ATTACHMENT_TOO_LARGE', 413, 'Each document must be 5 MB or smaller');
  if (buffer.length > 5 && buffer.toString('ascii', 0, 5) === '%PDF-') return { buffer, mime: 'application/pdf', ext: 'pdf' };
  const img = sniffImage(buffer);
  if (!img) throw new AppError('UNSUPPORTED_FILE_TYPE', 415, 'Documents must be PDF, JPG, PNG or WebP');
  const out = await optimizeImage({ buffer, ...img }, 'other');
  return { buffer: out.buffer, mime: out.mime as string, ext: out.ext as string };
}

/** Checks and stores the files first, then returns rows to create (so a bad file stops before anything is saved). */
export async function storeDocuments(userId: string, docs: DocumentInput[]) {
  const decoded = await Promise.all(docs.map(async (d) => ({ d, f: await decodeDocument(d.file) })));
  const rows = [];
  for (const { d, f } of decoded) {
    const key = privateKey(`instructor-docs/${userId}`, f.ext);
    await storage.putPrivate(key, f.buffer, f.mime);
    rows.push({ userId, title: d.title, isPublic: d.isPublic, storageKey: key, mime: f.mime, sizeBytes: f.buffer.length });
  }
  return rows;
}

export async function docView(d: InstructorDocument) {
  return {
    id: d.id,
    title: d.title,
    mime: d.mime,
    sizeBytes: d.sizeBytes,
    isPublic: d.isPublic,
    createdAt: d.createdAt,
    url: await storage.signedUrl(d.storageKey, DOC_URL_TTL),
  };
}

export async function profileView(p: InstructorProfile & { documents: InstructorDocument[] }) {
  return {
    status: p.status,
    phone: p.phone,
    headline: p.headline,
    bio: p.bio,
    expertise: p.expertise,
    sharePercentBp: p.sharePercentBp,
    rejectReason: p.rejectReason,
    submittedAt: p.submittedAt,
    reviewedAt: p.reviewedAt,
    documents: await Promise.all([...p.documents].sort((a, b) => +a.createdAt - +b.createdAt).map(docView)),
  };
}

export async function loadProfile(userId: string) {
  const p = await prisma.instructorProfile.findUnique({ where: { userId }, include: { documents: true } });
  if (!p) throw new AppError('NOT_FOUND', 404, 'No instructor profile');
  return p;
}

/** True when the user may use the instructor tools: an ADMIN, or an INSTRUCTOR whose profile is approved. */
export async function isApprovedInstructor(userId: string) {
  const p = await prisma.instructorProfile.findUnique({ where: { userId }, select: { status: true } });
  return p?.status === 'APPROVED';
}
