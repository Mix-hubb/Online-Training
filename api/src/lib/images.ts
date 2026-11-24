// Shrink uploaded images before they are stored (2026-11-23, performance review).
// A phone photo or a 4K logo shown at 56 px used to be sent to every visitor as is.
// Each kind has a maximum box (2x its biggest display size); images are never enlarged.
// Logos and signatures can be drawn into the certificate PDF (pdf-lib: PNG/JPG only), so they keep PNG/JPG;
// everything else becomes WebP. EXIF orientation is applied, and metadata (GPS etc.) is dropped.
// Banners and covers are what visitors look at most (2026-11-24): a bigger box for high-res screens,
// WebP quality 90, and an image that already fits the box and is not heavy is kept exactly as uploaded.
import sharp from 'sharp';
import type { CheckedImage } from './attachments.js';
import { AppError } from './errors.js';

export type ImageKind = 'cover' | 'banner' | 'logo' | 'signature' | 'avatar' | 'other' | 'chat' | 'slip';

const BOX: Record<ImageKind, { w: number; h: number }> = {
  cover: { w: 2000, h: 2000 },
  banner: { w: 2880, h: 2880 },
  logo: { w: 640, h: 320 },
  signature: { w: 1200, h: 400 },
  avatar: { w: 512, h: 512 },
  other: { w: 1920, h: 1920 },
  // Private: must stay readable (receipts, screenshots), so a larger box.
  chat: { w: 2000, h: 2000 },
  slip: { w: 2000, h: 2000 },
};
const PDF_SAFE: ReadonlySet<ImageKind> = new Set(['logo', 'signature']);
/** Shown large on the home page and course pages: keep them sharp. */
const SHOWCASE: ReadonlySet<ImageKind> = new Set(['banner', 'cover']);
const KEEP_AS_IS_BYTES = 1.5 * 1024 * 1024;

export async function optimizeImage(img: CheckedImage, kind: ImageKind): Promise<CheckedImage> {
  try {
    return await shrink(img, kind);
  } catch {
    // The magic bytes looked right but the image is broken (or far too large in pixels).
    throw new AppError('UNSUPPORTED_FILE_TYPE', 415, 'This image could not be read. Try another JPG, PNG or WebP file.');
  }
}

async function shrink(img: CheckedImage, kind: ImageKind): Promise<CheckedImage> {
  const box = BOX[kind];
  const fits = (img.width ?? Infinity) <= box.w && (img.height ?? Infinity) <= box.h;
  // Already the right size and not heavy: no re-encode, so no quality is lost at all.
  // Still re-encoded if it may carry an EXIF rotation or GPS data (JPEG), so photos show upright and stay private.
  if (SHOWCASE.has(kind) && fits && img.buffer.length <= KEEP_AS_IS_BYTES && !(await hasExif(img.buffer))) return img;
  const base = sharp(img.buffer, { limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width: box.w, height: box.h, fit: 'inside', withoutEnlargement: true });
  let out: { data: Buffer; info: sharp.OutputInfo };
  let mime: CheckedImage['mime'];
  let ext: CheckedImage['ext'];
  if (PDF_SAFE.has(kind)) {
    if (img.mime === 'image/jpeg') {
      out = await base.jpeg({ quality: 85, mozjpeg: true }).toBuffer({ resolveWithObject: true });
      [mime, ext] = ['image/jpeg', 'jpg'];
    } else {
      out = await base.png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer({ resolveWithObject: true });
      [mime, ext] = ['image/png', 'png'];
    }
  } else {
    out = await (SHOWCASE.has(kind) ? base.webp({ quality: 90, smartSubsample: true, effort: 5 }) : base.webp({ quality: 82 })).toBuffer({
      resolveWithObject: true,
    });
    [mime, ext] = ['image/webp', 'webp'];
  }
  // Keep the original if re-encoding made it bigger (already small and well compressed) and it fits the box.
  if (fits && out.data.length >= img.buffer.length && (!PDF_SAFE.has(kind) || img.mime !== 'image/webp')) return img;
  return { buffer: out.data, mime, ext, width: out.info.width, height: out.info.height };
}

async function hasExif(buf: Buffer): Promise<boolean> {
  const m = await sharp(buf).metadata();
  return !!m.exif || (m.orientation ?? 1) !== 1;
}
