// Dev/test video provider: no external account needed.
// Videos are READY at once (1080p source, 10 minutes) and play a public HLS test stream.
import crypto from 'node:crypto';
import type { CreatedVideo, VideoInfo, VideoProvider } from './VideoProvider.js';
import { config } from '../../config.js';

const TEST_STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

export class DevVideoProvider implements VideoProvider {
  async createVideo(): Promise<CreatedVideo> {
    const id = `dev-${crypto.randomUUID()}`;
    return { providerVideoId: id, uploadUrl: `${config.API_URL}/dev/video-upload/${id}` };
  }

  async getStatus(): Promise<VideoInfo> {
    return { status: 'READY', durationSec: 600, sourceHeight: 1080, readyHeights: [720, 1080] };
  }

  async getSignedPlaybackUrl(): Promise<string> {
    return TEST_STREAM;
  }

  async deleteVideo(): Promise<void> {}
}
