// Certificate PDF with pdf-lib (layout of 2026-11-27): A4 landscape, light guilloche paper, double frame with
// scroll ornaments in the corners, logo at the top, "Certificate of Completion" with a script "of", the
// statement left-aligned, certificate number + verify link + QR code bottom-left, stamp over the issuer name and
// the date bottom-right. Admin-editable fields come from CertificateTemplate (one template for every course).
// English only: the standard PDF fonts cannot draw Thai; such characters print as "?".
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';
import QRCode from 'qrcode';
import type { CertificateTemplate } from '@prisma/client';

const W = 841.89;
const H = 595.28;
const LEFT = 96;
const RIGHT = W - 96;
const INK = rgb(0.17, 0.18, 0.2);
const MUTED = rgb(0.38, 0.4, 0.43);
const PAPER = rgb(0.988, 0.988, 0.984);
const PATTERN = rgb(0.86, 0.875, 0.89);

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x1a73e8;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** The standard fonts only cover WinAnsi; anything else would throw while drawing. */
const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, '?');

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

/** Fine interlaced waves over the paper, like security paper. Drawn as SVG paths (origin top-left). */
function drawPaper(page: PDFPage) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
  const x0 = 40;
  const x1 = W - 40;
  const step = 16;
  for (let row = 0, y = 44; y < H - 40; row++, y += 9) {
    for (const phase of [0, step]) {
      let d = `M ${x0} ${y}`;
      for (let x = x0; x < x1; x += step * 2) {
        const up = (row + (phase ? 1 : 0)) % 2 ? -3.2 : 3.2;
        d += ` Q ${x + step / 2 + phase / 2} ${y + up} ${x + step} ${y} Q ${x + step * 1.5 + phase / 2} ${y - up} ${x + step * 2} ${y}`;
      }
      page.drawSvgPath(d, { x: 0, y: H, borderColor: PATTERN, borderWidth: 0.35 });
    }
  }
}

// One corner scroll, drawn for the top-left corner in a 70 x 70 box (x right, y down). The other corners mirror it.
const ORNAMENT: string[] = [
  // centre curl
  'M 30 22 C 30 12 18 9 13 15 C 8 21 13 29 20 27 C 25 25 24 18 19 18 C 16 18 15 22 18 23',
  // arm along the top edge, ending in a small curl
  'M 30 22 C 38 26 44 14 54 13 C 62 12 66 19 62 23 C 59 26 55 23 57 20',
  'M 44 17 C 48 22 54 23 58 30',
  // arm along the left edge (the same shape with x and y swapped)
  'M 22 30 C 26 38 14 44 13 54 C 12 62 19 66 23 62 C 26 59 23 55 20 57',
  'M 17 44 C 22 48 23 54 30 58',
  // inner bud
  'M 27 27 C 34 30 38 36 36 40 C 33 37 30 33 27 27 Z',
  // second, smaller scrolls further along each edge
  'M 54 13 C 60 6 68 6 70 11',
  'M 13 54 C 6 60 6 68 11 70',
  // corner leaf
  'M 4 4 C 10 2 14 6 12 11 C 7 12 3 9 4 4 Z',
];
const ORN = 1.35; // drawn size of the 70-unit ornament box

function mirror(d: string, fx: boolean, fy: boolean): string {
  const nums = d.split(' ');
  let axis = 0;
  return nums
    .map((t) => {
      const n = Number(t);
      if (Number.isNaN(n)) {
        axis = 0;
        return t;
      }
      const out = (axis === 0 ? (fx ? 70 - n : n) : fy ? 70 - n : n) * ORN;
      axis = 1 - axis;
      return String(out);
    })
    .join(' ');
}

function drawFrame(page: PDFPage) {
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: INK, borderWidth: 3.2 });
  page.drawRectangle({ x: 31, y: 31, width: W - 62, height: H - 62, borderColor: INK, borderWidth: 0.9 });
  const pad = 37;
  const corners: Array<[number, number, boolean, boolean]> = [
    [pad, H - pad, false, false],
    [W - pad - 70 * ORN, H - pad, true, false],
    [pad, pad + 70 * ORN, false, true],
    [W - pad - 70 * ORN, pad + 70 * ORN, true, true],
  ];
  for (const [x, y, fx, fy] of corners) {
    for (const d of ORNAMENT) {
      const closed = d.endsWith('Z');
      page.drawSvgPath(mirror(d, fx, fy), { x, y, borderColor: INK, borderWidth: 1.5, ...(closed ? { color: INK } : {}) });
    }
  }
}

interface Run {
  text: string;
  font: PDFFont;
  size: number;
  /** A filled-in blank: drawn on a line, never split across lines. */
  blank?: boolean;
}

/** Lays out mixed-font text left-aligned between LEFT and RIGHT; returns the y below the last line. */
function drawParagraph(page: PDFPage, runs: Run[], top: number, lineGap: number): number {
  type Piece = { text: string; font: PDFFont; size: number; w: number; blank?: boolean };
  const pieces: Piece[] = [];
  for (const r of runs) {
    if (r.blank) {
      const t = safe(r.text);
      pieces.push({ text: t, font: r.font, size: r.size, w: Math.max(r.font.widthOfTextAtSize(t, r.size) + 28, 190), blank: true });
      continue;
    }
    for (const word of safe(r.text).split(/(?<= )/)) {
      if (word) pieces.push({ text: word, font: r.font, size: r.size, w: r.font.widthOfTextAtSize(word, r.size) });
    }
  }
  let x = LEFT;
  let y = top;
  for (const p of pieces) {
    const width = p.text.trimEnd() === p.text ? p.w : p.font.widthOfTextAtSize(p.text.trimEnd(), p.size);
    if (x > LEFT && x + width > RIGHT) {
      x = LEFT;
      y -= lineGap;
      if (!p.blank && p.text.trim() === '') continue;
    }
    if (p.blank) {
      page.drawLine({ start: { x, y: y - 5 }, end: { x: x + p.w, y: y - 5 }, thickness: 0.8, color: INK });
      const tw = p.font.widthOfTextAtSize(p.text, p.size);
      page.drawText(p.text, { x: x + (p.w - tw) / 2, y: y - 1, size: p.size, font: p.font, color: INK });
      x += p.w + p.font.widthOfTextAtSize(' ', p.size);
    } else {
      page.drawText(p.text, { x, y, size: p.size, font: p.font, color: INK });
      x += p.w;
    }
  }
  return y - lineGap;
}

function wrapCentered(page: PDFPage, text: string, cx: number, top: number, maxW: number, font: PDFFont, size: number, color: RGB) {
  const words = safe(text).split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && font.widthOfTextAtSize(next, size) > maxW) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((l, k) => {
    page.drawText(l, { x: cx - font.widthOfTextAtSize(l, size) / 2, y: top - k * (size + 3), size, font, color });
  });
  return lines.length;
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
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const script = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const accent = hexToRgb(i.template.primaryColor);
  const issuer = i.template.issuerName.trim();

  drawPaper(page);
  drawFrame(page);

  // Logo, centred at the top.
  const logo = await fetchImage(doc, i.template.logoUrl);
  if (logo) {
    const s = logo.scaleToFit(150, 84);
    page.drawImage(logo, { x: (W - s.width) / 2, y: H - 62 - s.height, width: s.width, height: s.height });
  }

  // Heading: "Certificate of Completion" with the "of" in script, as on printed certificates.
  const heading = safe(i.template.heading.trim() || 'Certificate of Completion');
  const m = / of /i.exec(heading);
  const headY = H - 186;
  const size = 34;
  if (m) {
    const a = heading.slice(0, m.index) + ' ';
    const of = heading.slice(m.index + 1, m.index + 3);
    const b = ' ' + heading.slice(m.index + 4);
    const wa = sansBold.widthOfTextAtSize(a, size);
    const wo = script.widthOfTextAtSize(of, size + 2);
    const wb = sansBold.widthOfTextAtSize(b, size);
    let x = (W - wa - wo - wb) / 2;
    page.drawText(a, { x, y: headY, size, font: sansBold, color: INK });
    x += wa;
    page.drawText(of, { x, y: headY, size: size + 2, font: script, color: INK });
    x += wo;
    page.drawText(b, { x, y: headY, size, font: sansBold, color: INK });
  } else {
    page.drawText(heading, { x: (W - sansBold.widthOfTextAtSize(heading, size)) / 2, y: headY, size, font: sansBold, color: INK });
  }
  // Divider: two rules and a dot in the accent colour.
  const dy = headY - 22;
  page.drawLine({ start: { x: W / 2 - 120, y: dy }, end: { x: W / 2 - 12, y: dy }, thickness: 1.4, color: INK });
  page.drawLine({ start: { x: W / 2 + 12, y: dy }, end: { x: W / 2 + 120, y: dy }, thickness: 1.4, color: INK });
  page.drawCircle({ x: W / 2, y: dy, size: 3.2, color: accent });

  // The statement.
  const body = 15;
  const runs: Run[] = [
    { text: 'This certifies that ', font: sans, size: body },
    { text: i.learnerName, font: sansBold, size: body + 1, blank: true },
    { text: 'has successfully completed the training course of ', font: sans, size: body },
    { text: i.courseTitle, font: sansBold, size: body },
    ...(issuer ? [{ text: ' organized by ', font: sans, size: body }, { text: issuer, font: sans, size: body }] : []),
    { text: '.', font: sans, size: body },
  ];
  drawParagraph(page, runs, dy - 62, 42);

  // Bottom-left: QR code, certificate number, verify link.
  const qrPng = await QRCode.toBuffer(i.verifyUrl, { margin: 0, width: 360, errorCorrectionLevel: 'M', color: { dark: '#2b2e33', light: '#ffffff' } });
  const qr = await doc.embedPng(qrPng);
  const q = 72;
  page.drawImage(qr, { x: LEFT, y: 72, width: q, height: q });
  const tx = LEFT + q + 16;
  const label = (k: string, v: string, y: number, vs = 12) => {
    page.drawText(k, { x: tx, y, size: 12, font: sansBold, color: INK });
    page.drawText(safe(v), { x: tx + sansBold.widthOfTextAtSize(k, 12) + 6, y, size: vs, font: sans, color: INK });
  };
  label('Certificate Number:', i.number, 124);
  label('Certificate Inquiry:', i.verifyUrl, 98, 11);
  page.drawText('Scan the code or open the link to check this certificate.', { x: tx, y: 77, size: 9, font: sans, color: MUTED });

  // Bottom-right: issuer name with the stamp over it, then the date on a line.
  // Date sits on the Certificate Number row, so the long verify link below has the full width.
  const cx = W - 200;
  if (issuer) wrapCentered(page, issuer.toUpperCase(), cx, 182, 220, sansBold, 12.5, INK);
  const stamp = await fetchImage(doc, i.template.stampUrl);
  if (stamp) {
    const s = stamp.scaleToFit(92, 92);
    page.drawImage(stamp, { x: cx - s.width / 2 + 6, y: 184 - s.height / 2, width: s.width, height: s.height, opacity: 0.88 });
  }
  const date = i.issuedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
  page.drawText('Date', { x: cx - 100, y: 124, size: 12.5, font: sansBold, color: INK });
  page.drawLine({ start: { x: cx - 64, y: 121 }, end: { x: cx + 110, y: 121 }, thickness: 0.8, color: INK });
  page.drawText(date, { x: cx + 23 - sans.widthOfTextAtSize(date, 12) / 2, y: 125, size: 12, font: sans, color: INK });

  return doc.save();
}
