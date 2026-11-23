// One-off: shrink images that were uploaded before src/lib/images.ts existed (local storage only).
// Keeps each file's name and format (URLs in the database stay valid); only resizes files bigger than their box.
//   npx tsx scripts/shrink-uploads.ts            dry run: lists what would change
//   npx tsx scripts/shrink-uploads.ts --write    rewrites the files in place (back up uploads/ first)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BOX: Record<string, { w: number; h: number }> = {
  cover: { w: 1600, h: 1600 },
  banner: { w: 1920, h: 1920 },
  logo: { w: 640, h: 320 },
  signature: { w: 1200, h: 400 },
  avatar: { w: 512, h: 512 },
};
sharp.cache(false); // Windows: do not keep the source files open while they are rewritten
const root = path.resolve('uploads/public');
const write = process.argv.includes('--write');

for (const [dir, box] of Object.entries(BOX)) {
  const folder = path.join(root, dir);
  if (!fs.existsSync(folder)) continue;
  for (const name of fs.readdirSync(folder)) {
    const file = path.join(folder, name);
    const ext = path.extname(name).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;
    const src = fs.readFileSync(file);
    const meta = await sharp(src).metadata();
    if ((meta.width ?? 0) <= box.w && (meta.height ?? 0) <= box.h) continue;
    const img = sharp(src).rotate().resize({ width: box.w, height: box.h, fit: 'inside' });
    const out = ext === '.png' ? img.png({ compressionLevel: 9, palette: true }) : ext === '.webp' ? img.webp({ quality: 82 }) : img.jpeg({ quality: 85, mozjpeg: true });
    const buf = await out.toBuffer();
    const before = fs.statSync(file).size;
    console.log(`${dir}/${name}: ${meta.width}x${meta.height} ${Math.round(before / 1024)} KB -> ${Math.round(buf.length / 1024)} KB`);
    if (write) fs.writeFileSync(file, buf);
  }
}
if (!write) console.log('Dry run. Add --write to apply.');
