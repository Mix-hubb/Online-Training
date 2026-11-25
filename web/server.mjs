// Production static server for the built site (Railway, 2026-11-25). No dependencies: Node built-ins only.
// - Serves web/dist. Any path that is not a file gets index.html, so /admin/... and refreshes work (SPA).
// - /assets/* have hashed names: cached for a year. index.html is never cached, so a deploy shows at once.
// - gzip for text files (compressed once, kept in memory). Listens on $PORT (Railway sets it).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT) || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};
const COMPRESS = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.webmanifest']);
const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

/** path -> { body, gz, type, ext } ; the build never changes while the server runs. */
const cache = new Map();

async function load(file) {
  if (cache.has(file)) return cache.get(file);
  const body = await fs.readFile(file);
  const ext = path.extname(file).toLowerCase();
  const entry = { body, ext, type: TYPES[ext] ?? 'application/octet-stream', gz: COMPRESS.has(ext) ? zlib.gzipSync(body, { level: 9 }) : null };
  cache.set(file, entry);
  return entry;
}

async function resolve(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const file = path.resolve(root, '.' + p);
  if (file !== root && !file.startsWith(root + path.sep)) return null; // no ../ outside dist
  try {
    if ((await fs.stat(file)).isFile()) return file;
  } catch {
    /* not a file */
  }
  // A missing hashed asset is a real 404 (old tab after a deploy); anything else is an app route.
  if (p.startsWith('/assets/')) return null;
  return path.join(root, 'index.html');
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const file = await resolve(req.url ?? '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...HEADERS }).end('Not found');
    return;
  }
  let entry;
  try {
    entry = await load(file);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Server error');
    return;
  }
  const immutable = file.startsWith(path.join(root, 'assets') + path.sep);
  const useGz = entry.gz && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  const body = useGz ? entry.gz : entry.body;
  res.writeHead(200, {
    ...HEADERS,
    'Content-Type': entry.type,
    'Content-Length': body.length,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    Vary: 'Accept-Encoding',
    ...(useGz ? { 'Content-Encoding': 'gzip' } : {}),
  });
  res.end(req.method === 'HEAD' ? undefined : body);
});

server.listen(port, () => console.log(`Web listening on :${port}`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
