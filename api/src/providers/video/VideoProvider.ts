// Video provider interface (spec 10.1: provider not final; default Bunny Stream).
// Business code only talks to this interface, never to Bunny directly.
export type VideoStatus = 'PROCESSING' | 'READY' | 'FAILED';

export interface CreatedVideo {
  providerVideoId: string;
  /** Where the admin browser uploads the file (TUS upload). */
  uploadUrl: string;
  uploadHeaders?: Record<string, string>;
}

export interface VideoInfo {
  status: VideoStatus;
  durationSec?: number;
  /** Source height in px (e.g. 2160). */
  sourceHeight?: number;
  /** Heights the provider has finished encoding. */
  readyHeights?: number[];
}

export interface VideoProvider {
  createVideo(title: string): Promise<CreatedVideo>;
  getStatus(providerVideoId: string): Promise<VideoInfo>;
  /** Short-lived signed HLS URL. Only call after the access check passed. */
  getSignedPlaybackUrl(providerVideoId: string, ttlSec: number): Promise<string>;
  deleteVideo(providerVideoId: string): Promise<void>;
}

/** Spec 15.5: renditions 720p, 1080p, 4K (2160p); never above the source; 4K only when allowed. */
export const RENDITION_HEIGHTS = [720, 1080, 2160] as const;

export function allowedRenditions(sourceHeight: number | null | undefined, allow4k: boolean): number[] {
  const src = sourceHeight ?? 0;
  const list = RENDITION_HEIGHTS.filter((h) => h <= src && (h !== 2160 || allow4k));
  // A source below 720p still plays at its own height (no upscaling).
  return list.length ? [...list] : src > 0 ? [src] : [];
}
