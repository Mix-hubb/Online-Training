// Attaches an HLS stream to a <video>. Exposes quality levels (Auto + heights) and a setter (spec 15.5).
// hls.js (~500 KB) is loaded only when a video actually plays, not with the lesson page (2026-11-23).
// autoplay: start playing as soon as the stream is ready (used when the learner picks a lesson, 2026-11-24).
import type Hls from 'hls.js';
import { onBeforeUnmount, ref, type Ref } from 'vue';

const hasMse = () => typeof window !== 'undefined' && ('MediaSource' in window || 'ManagedMediaSource' in window);

export function useHls(video: Ref<HTMLVideoElement | null>) {
  let hls: Hls | null = null;
  let token = 0; // a newer load() wins over one still waiting for hls.js
  const levels = ref<number[]>([]);
  const current = ref<number | 'auto'>('auto');
  const error = ref<string | null>(null);

  function destroy() {
    token++;
    hls?.destroy();
    hls = null;
  }

  /** The learner just clicked, so the browser allows playback with sound; ignore a refusal (they press play). */
  function start(el: HTMLVideoElement, mine: number) {
    if (mine === token) void el.play().catch(() => undefined);
  }

  async function load(url: string, startAt = 0, allowed: number[] = [], autoplay = false) {
    destroy();
    const mine = ++token;
    error.value = null;
    current.value = 'auto';
    const el = video.value;
    if (!el) return;
    const Hls = hasMse() ? (await import('hls.js').catch(() => null))?.default : undefined;
    if (mine !== token) return;
    if (Hls?.isSupported()) {
      hls = new Hls({ startPosition: startAt > 0 ? startAt : -1 });
      hls.loadSource(url);
      hls.attachMedia(el);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const max = allowed.length ? Math.max(...allowed) : Infinity;
        levels.value = [...new Set(hls!.levels.map((l) => l.height))].filter((h) => h <= max).sort((a, b) => b - a);
        if (allowed.length) hls!.autoLevelCapping = hls!.levels.reduce((best, l, i) => (l.height <= max ? i : best), -1);
        if (autoplay) start(el, mine);
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) error.value = 'The video could not be loaded.';
      });
    } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = url;
      el.addEventListener(
        'loadedmetadata',
        () => {
          if (startAt > 0) el.currentTime = startAt;
          if (autoplay) start(el, mine);
        },
        { once: true },
      );
      levels.value = [];
    } else {
      error.value = 'This browser cannot play the video.';
    }
  }

  function setQuality(q: number | 'auto') {
    current.value = q;
    if (!hls) return;
    if (q === 'auto') {
      hls.currentLevel = -1;
      return;
    }
    const idx = hls.levels.findIndex((l) => l.height === q);
    if (idx >= 0) hls.currentLevel = idx;
  }

  onBeforeUnmount(destroy);
  return { load, levels, current, setQuality, error, destroy };
}
