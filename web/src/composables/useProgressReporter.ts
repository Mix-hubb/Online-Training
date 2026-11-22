// Sends { position, watchedDelta } about every 10 s while the video plays (spec section 4).
// watchedDelta counts only real playing time (seeking does not add to it); the server caps it again.
import { onBeforeUnmount, ref, type Ref } from 'vue';
import * as learningApi from '@/api/learning';

export function useProgressReporter(video: Ref<HTMLVideoElement | null>, onUpdate: (r: { watchedSec: number; completed: boolean }) => void) {
  let lessonId: string | null = null;
  let watched = 0;
  let lastTime = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const sending = ref(false);

  function onTime() {
    const el = video.value;
    if (!el || el.paused || el.seeking) {
      lastTime = el?.currentTime ?? 0;
      return;
    }
    const d = el.currentTime - lastTime;
    if (d > 0 && d < 2 / Math.max(1, el.playbackRate) + 1) watched += d / Math.max(1, el.playbackRate);
    lastTime = el.currentTime;
  }

  async function flush() {
    const el = video.value;
    if (!lessonId || !el || sending.value) return;
    const delta = Math.floor(watched);
    if (delta <= 0 && el.paused) return;
    watched -= delta;
    sending.value = true;
    try {
      const r = await learningApi.progress(lessonId, Math.floor(el.currentTime), delta);
      onUpdate(r);
    } catch {
      /* keep going; next report retries */
    } finally {
      sending.value = false;
    }
  }

  function attach(id: string) {
    void flush();
    detachEvents();
    lessonId = id;
    watched = 0;
    lastTime = video.value?.currentTime ?? 0;
    video.value?.addEventListener('timeupdate', onTime);
    video.value?.addEventListener('seeked', onSeek);
    video.value?.addEventListener('pause', flushNow);
    video.value?.addEventListener('ended', flushNow);
    timer = setInterval(() => void flush(), 10_000);
  }

  function onSeek() {
    lastTime = video.value?.currentTime ?? 0;
  }
  function flushNow() {
    void flush();
  }

  function detachEvents() {
    if (timer) clearInterval(timer);
    timer = null;
    video.value?.removeEventListener('timeupdate', onTime);
    video.value?.removeEventListener('seeked', onSeek);
    video.value?.removeEventListener('pause', flushNow);
    video.value?.removeEventListener('ended', flushNow);
  }

  onBeforeUnmount(() => {
    void flush();
    detachEvents();
  });

  return { attach, flush };
}
