// Bunny Storage implementation of FileStorage (2026-11-25).
// Two storage zones in the same region:
// - public zone + pull zone (CDN): covers, banners, logos, signatures. URL = BUNNY_STORAGE_CDN_URL/<key>.
// - private zone, NO pull zone: payment slips, chat photos. Nothing on the internet can read it; the api fetches
//   the file with the zone's password and serves it at /files/private/<key>?exp=&sig= (same signed link as local).
// One zone with a private/ folder is not used on purpose: a pull zone serves the whole zone, so an old link
// to a slip would keep working forever through the CDN.
import type { FileStorage } from './FileStorage.js';
import { signedApiUrl } from './LocalStorage.js';
import { config } from '../../config.js';

type Zone = 'public' | 'private';

function zone(z: Zone) {
  return z === 'public'
    ? { name: config.BUNNY_STORAGE_ZONE, key: config.BUNNY_STORAGE_KEY }
    : { name: config.BUNNY_STORAGE_PRIVATE_ZONE, key: config.BUNNY_STORAGE_PRIVATE_KEY };
}

function endpoint(z: Zone, key: string) {
  const path = key.split('/').map(encodeURIComponent).join('/');
  return `https://${config.BUNNY_STORAGE_HOST}/${zone(z).name}/${path}`;
}

export class BunnyStorage implements FileStorage {
  private async upload(z: Zone, key: string, body: Buffer, contentType: string) {
    const res = await fetch(endpoint(z, key), {
      method: 'PUT',
      headers: { AccessKey: zone(z).key, 'Content-Type': contentType },
      body: new Uint8Array(body),
    });
    if (!res.ok) throw new Error(`Bunny Storage upload failed (${z} zone): ${res.status}`);
  }

  async putPublic(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.upload('public', key, body, contentType);
    return `${config.BUNNY_STORAGE_CDN_URL}/${key}`;
  }

  async putPrivate(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.upload('private', key, body, contentType);
  }

  async signedUrl(key: string, ttlSec: number): Promise<string> {
    return signedApiUrl(key, ttlSec);
  }

  async delete(key: string, visibility: Zone): Promise<void> {
    await fetch(endpoint(visibility, key), { method: 'DELETE', headers: { AccessKey: zone(visibility).key } });
  }
}

/** Reads a private file for /files/private. null when it is not there. */
export async function readBunnyPrivate(key: string): Promise<{ body: Buffer; type: string } | null> {
  const res = await fetch(endpoint('private', key), { headers: { AccessKey: zone('private').key } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Bunny Storage read failed: ${res.status}`);
  return { body: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') ?? 'application/octet-stream' };
}
