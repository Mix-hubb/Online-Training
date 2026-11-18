// Bunny Stream implementation of VideoProvider.
// TODO before production: confirm the provider with the owner (spec 10.1) and test against a real library.
import crypto from 'node:crypto';
import type { CreatedVideo, VideoInfo, VideoProvider } from './VideoProvider.js';
import { config } from '../../config.js';

const API = 'https://video.bunnycdn.com';

export class BunnyStreamProvider implements VideoProvider {
  private headers() {
    return { AccessKey: config.BUNNY_STREAM_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' };
  }

  async createVideo(title: string): Promise<CreatedVideo> {
    const lib = config.BUNNY_STREAM_LIBRARY_ID;
    const res = await fetch(`${API}/library/${lib}/videos`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ title }) });
    if (!res.ok) throw new Error(`Bunny createVideo failed: ${res.status}`);
    const { guid } = (await res.json()) as { guid: string };
    // TUS upload signature so the browser never sees the API key.
    const expire = Math.floor(Date.now() / 1000) + 6 * 3600;
    const signature = crypto.createHash('sha256').update(`${lib}${config.BUNNY_STREAM_API_KEY}${expire}${guid}`).digest('hex');
    return {
      providerVideoId: guid,
      uploadUrl: `${API}/tusupload`,
      uploadHeaders: {
        AuthorizationSignature: signature,
        AuthorizationExpire: String(expire),
        VideoId: guid,
        LibraryId: lib,
      },
    };
  }

  async getStatus(id: string): Promise<VideoInfo> {
    const res = await fetch(`${API}/library/${config.BUNNY_STREAM_LIBRARY_ID}/videos/${id}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Bunny getStatus failed: ${res.status}`);
    const v = (await res.json()) as { status: number; length: number; height: number; availableResolutions?: string };
    const readyHeights = (v.availableResolutions ?? '')
      .split(',')
      .map((r) => parseInt(r, 10))
      .filter((n) => Number.isFinite(n));
    const status = v.status === 4 ? 'READY' : v.status === 5 || v.status === 6 ? 'FAILED' : 'PROCESSING';
    return { status, durationSec: Math.round(v.length ?? 0), sourceHeight: v.height || undefined, readyHeights };
  }

  /** Bunny CDN token auth with token_path so every HLS segment under /<id>/ is covered. */
  async getSignedPlaybackUrl(id: string, ttlSec: number): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + ttlSec;
    const tokenPath = `/${id}/`;
    const hashable = `${config.BUNNY_STREAM_TOKEN_KEY}${tokenPath}${expires}token_path=${tokenPath}`;
    const token = crypto.createHash('sha256').update(hashable).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const tp = encodeURIComponent(tokenPath);
    return `https://${config.BUNNY_CDN_HOSTNAME}/bcdn_token=${token}&expires=${expires}&token_path=${tp}${tokenPath}playlist.m3u8`;
  }

  async deleteVideo(id: string): Promise<void> {
    await fetch(`${API}/library/${config.BUNNY_STREAM_LIBRARY_ID}/videos/${id}`, { method: 'DELETE', headers: this.headers() });
  }
}
