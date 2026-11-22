// Shared landing data (header/footer/home use the same request).
import { ref } from 'vue';
import * as landingApi from '@/api/landing';
import type { Landing } from '@/types';

const landing = ref<Landing | null>(null);
let pending: Promise<void> | null = null;

export function useLanding() {
  function load(force = false) {
    if (landing.value && !force) return Promise.resolve();
    pending ??= landingApi
      .landing()
      .then((l) => {
        landing.value = l;
      })
      .catch(() => undefined)
      .finally(() => {
        pending = null;
      });
    return pending;
  }
  return { landing, load };
}
