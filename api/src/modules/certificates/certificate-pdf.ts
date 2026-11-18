// Certificate PDF with pdf-lib: fixed A4 landscape layout (spec section 4, Certificate).
// Admin-editable fields come from CertificateTemplate. Times (serif) stands in for Fraunces;
// embed the Fraunces TTF with @pdf-lib/fontkit later if the owner wants the exact font.
import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'pdf-lib';
import type { CertificateTemplate } from '@prisma/client';

const W = 841.89;
const H = 595.28;

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x1a73e8;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

async function fetchImage(doc: PDFDocument, url: string | null | undefined): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes[0] === 0x89) return await doc.embedPng(bytes);
    if (bytes[0] === 0xff) return await doc.embedJpg(bytes);
    return null;
  } catch {
    return null;
  }
}

export interface CertificatePdfInput {
  number: string;
  learnerName: string;
  courseTitle: string;
  issuedAt: Date;
  verifyUrl: string;
  template: CertificateTemplate;
}

export async function renderCertificatePdf(i: CertificatePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Certificate ${i.number}`);
  const page = doc.addPage([W, H]);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const accent = hexToRgb(i.template.primaryColor);
  const ink = rgb(0.12, 0.13, 0.15);
  const muted = rgb(0.4, 0.42, 0.45);

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0xf6 / 255, 0xf4 / 255, 0xee / 255) });
  page.drawRectangle({ x: 28, y: 28, width: W - 56, height: H - 56, borderColor: accent, borderWidth: 2 });
  page.drawRectangle({ x: 36, y: 36, width: W - 72, height: H - 72, borderColor: accent, borderWidth: 0.5, opacity: 0 });

  const center = (text: string, y: number, font = serif, size = 14, color = ink) => {
    const safe = text.replace(/[^\x20-\x7E -ÿ]/g, '?');
    const w = font.widthOfTextAtSize(safe, size);
    page.drawText(safe, { x: (W - w) / 2, y, size, font, color });
  };

  const logo = await fetchImage(doc, i.template.logoUrl);
  if (logo) {
    const s = logo.scaleToFit(140, 56);
    page.drawImage(logo, { x: (W - s.width) / 2, y: H - 120, width: s.width, height: s.height });
  }

  center(i.template.heading || 'Certificate of Completion', H - 170, serifBold, 34, accent);
  center('This certifies that', H - 215, sans, 12, muted);
  center(i.learnerName, H - 265, serifBold, 30);
  page.drawLine({ start: { x: W / 2 - 180, y: H - 275 }, end: { x: W / 2 + 180, y: H - 275 }, thickness: 0.6, color: muted });
  center('has successfully completed the course', H - 305, sans, 12, muted);
  center(i.courseTitle, H - 340, serif, 22);
  center(`Issued ${i.issuedAt.toISOString().slice(0, 10)}${i.template.issuerName ? ` by ${i.template.issuerName}` : ''}`, H - 375, sans, 11, muted);

  const sig = await fetchImage(doc, i.template.signatureUrl);
  const sx = W - 300;
  if (sig) {
    const s = sig.scaleToFit(160, 50);
    page.drawImage(sig, { x: sx + (200 - s.width) / 2, y: 128, width: s.width, height: s.height });
  }
  page.drawLine({ start: { x: sx, y: 122 }, end: { x: sx + 200, y: 122 }, thickness: 0.6, color: muted });
  const sn = i.template.signerName || '';
  const st = i.template.signerTitle || '';
  page.drawText(sn, { x: sx + (200 - serif.widthOfTextAtSize(sn, 13)) / 2, y: 104, size: 13, font: serif, color: ink });
  page.drawText(st, { x: sx + (200 - sans.widthOfTextAtSize(st, 10)) / 2, y: 90, size: 10, font: sans, color: muted });

  page.drawText(`Certificate no. ${i.number}`, { x: 70, y: 104, size: 10, font: sans, color: muted });
  page.drawText(`Verify: ${i.verifyUrl}`, { x: 70, y: 90, size: 9, font: sans, color: muted });

  return doc.save();
}
