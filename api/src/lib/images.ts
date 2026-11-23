// Shrink uploaded images before they are stored (2026-11-23, performance review).
// A phone photo or a 4K logo shown at 56 px used to be sent to every visitor as is.
// Each kind has a maximum box (2x its biggest display size); images are never enlarged.
// Logos and signatures can be drawn into the certificate PDF (pdf-lib: PNG/JPG only), so they keep PNG/JPG;
// everything else becomes WebP. EXIF orientation is applied, and metadata (GPS etc.) is dropped.
import sharp from 'sharp';
import type { CheckedImage } from './attachments.js';
import { AppError } from './errors.js';

export type ImageKind = 'cover' | 'banner' | 'logo' | 'signature' | 'avatar' | 'other' | 'chat' | 'slip';

const BOX: Record<ImageKind, { w: number; h: number }> = {
  cover: { w: 1600, h: 1600 },
  banner: { w: 1920, h: 1920 },
  logo: { w: 640, h: 320 },
  signature: { w: 1200, h: 400 },
  avatar: { w: 512, h: 512 },
  other: { w: 1920, h: 1920 },
  // Private: must stay readable (receipts, screenshots), so a larger box.
  chat: { w: 2000, h: 2000 },
  slip: { w: 2000, h: 2000 },
};
const PDF_SAFE: ReadonlySet<ImageKind> = new Set(['logo', 'signature']);

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
    out = await base.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    [mime, ext] = ['image/webp', 'webp'];
  }
  // Keep the original if re-encoding made it bigger (already small and well compressed) and it fits the box.
  const fits = (img.width ?? Infinity) <= box.w && (img.height ?? Infinity) <= box.h;
  if (fits && out.data.length >= img.buffer.length && (!PDF_SAFE.has(kind) || img.mime !== 'image/webp')) return img;
  return { buffer: out.data, mime, ext, width: out.info.width, height: out.info.height };
}
