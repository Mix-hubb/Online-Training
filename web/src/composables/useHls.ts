// Attaches an HLS stream to a <video>. Exposes quality levels (Auto + heights) and a setter (spec 15.5).
import Hls from 'hls.js';
import { onBeforeUnmount, ref, type Ref } from 'vue';

export function useHls(video: Ref<HTMLVideoElement | null>) {
  let hls: Hls | null = null;
  const levels = ref<number[]>([]);
  const current = ref<number | 'auto'>('auto');
  const error = ref<string | null>(null);

  function destroy() {
    hls?.destroy();
    hls = null;
  }

  function load(url: string, startAt = 0, allowed: number[] = []) {
    destroy();
    error.value = null;
    current.value = 'auto';
    const el = video.value;
    if (!el) return;
    if (Hls.isSupported()) {
      hls = new Hls({ startPosition: startAt > 0 ? startAt : -1 });
      hls.loadSource(url);
      hls.attachMedia(el);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const max = allowed.length ? Math.max(...allowed) : Infinity;
        levels.value = [...new Set(hls!.levels.map((l) => l.height))].filter((h) => h <= max).sort((a, b) => b - a);
        if (allowed.length) hls!.autoLevelCapping = hls!.levels.reduce((best, l, i) => (l.height <= max ? i : best), -1);
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) error.value = 'The video could not be loaded.';
      });
    } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = url;
      el.addEventListener('loadedmetadata', () => startAt > 0 && (el.currentTime = startAt), { once: true });
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
