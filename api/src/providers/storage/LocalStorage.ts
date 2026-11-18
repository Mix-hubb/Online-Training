// Local disk storage for development and tests.
// Public files are served at /files/public/<key>. Private files at /files/private/<key>?exp=&sig= (HMAC-signed).
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FileStorage } from './FileStorage.js';
import { config } from '../../config.js';

const root = path.resolve(config.UPLOAD_DIR);

function safeJoin(base: string, key: string): string {
  const p = path.resolve(base, key);
  if (!p.startsWith(base + path.sep)) throw new Error('Bad storage key');
  return p;
}

export function signPrivate(key: string, exp: number): string {
  return crypto.createHmac('sha256', config.JWT_SECRET).update(`${key}:${exp}`).digest('base64url');
}

export function verifyPrivate(key: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const want = Buffer.from(signPrivate(key, exp));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export const localPaths = {
  public: path.join(root, 'public'),
  private: path.join(root, 'private'),
  resolvePrivate: (key: string) => safeJoin(path.join(root, 'private'), key),
};

export class LocalStorage implements FileStorage {
  async putPublic(key: string, body: Buffer): Promise<string> {
    const p = safeJoin(localPaths.public, key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body);
    return `${config.API_URL}/files/public/${key}`;
  }

  async putPrivate(key: string, body: Buffer): Promise<void> {
    const p = safeJoin(localPaths.private, key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body);
  }

  async signedUrl(key: string, ttlSec: number): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttlSec;
    return `${config.API_URL}/files/private/${key}?exp=${exp}&sig=${signPrivate(key, exp)}`;
  }

  async delete(key: string, visibility: 'public' | 'private'): Promise<void> {
    const base = visibility === 'public' ? localPaths.public : localPaths.private;
    await fs.rm(safeJoin(base, key), { force: true });
  }
}
