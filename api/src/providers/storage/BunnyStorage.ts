// Bunny Storage implementation of FileStorage.
// Public files go under public/, private files under private/ in the same zone.
// The pull zone must have Token Authentication on for the private/ folder (or use a second, private zone).
// TODO before production: confirm zone layout with the owner and test signed URLs against the real pull zone.
import crypto from 'node:crypto';
import type { FileStorage } from './FileStorage.js';
import { config } from '../../config.js';

export class BunnyStorage implements FileStorage {
  private endpoint(key: string) {
    return `https://${config.BUNNY_STORAGE_HOST}/${config.BUNNY_STORAGE_ZONE}/${key}`;
  }

  private async upload(key: string, body: Buffer, contentType: string) {
    const res = await fetch(this.endpoint(key), {
      method: 'PUT',
      headers: { AccessKey: config.BUNNY_STORAGE_KEY, 'Content-Type': contentType },
      body,
    });
    if (!res.ok) throw new Error(`Bunny Storage upload failed: ${res.status}`);
  }

  async putPublic(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.upload(`public/${key}`, body, contentType);
    return `${config.BUNNY_STORAGE_CDN_URL}/public/${key}`;
  }

  async putPrivate(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.upload(`private/${key}`, body, contentType);
  }

  /** Bunny CDN token authentication: base64url(sha256(securityKey + path + expires)). */
  async signedUrl(key: string, ttlSec: number): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + ttlSec;
    const urlPath = `/private/${key}`;
    const token = crypto
      .createHash('sha256')
      .update(config.BUNNY_STREAM_TOKEN_KEY + urlPath + expires)
      .digest('base64')
      .replace(/\n/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return `${config.BUNNY_STORAGE_CDN_URL}${urlPath}?token=${token}&expires=${expires}`;
  }

  async delete(key: string, visibility: 'public' | 'private'): Promise<void> {
    await fetch(this.endpoint(`${visibility}/${key}`), { method: 'DELETE', headers: { AccessKey: config.BUNNY_STORAGE_KEY } });
  }
}
