// Countdown to the server deadline (the server enforces it; this is display only).
import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';

export function useQuizTimer(deadline: Ref<string | null | undefined>, onExpire: () => void) {
  const now = ref(Date.now());
  const t = setInterval(() => (now.value = Date.now()), 1000);
  onBeforeUnmount(() => clearInterval(t));
  const remaining = computed(() => (deadline.value ? Math.max(0, Math.floor((new Date(deadline.value).getTime() - now.value) / 1000)) : null));
  let fired = false;
  watch(remaining, (r) => {
    if (r === 0 && !fired) {
      fired = true;
      onExpire();
    }
  });
  const low = computed(() => remaining.value !== null && remaining.value <= 60);
  return { remaining, low };
}
