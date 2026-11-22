// After the Stripe redirect: poll the order by session id until PAID (or give up after ~90 s).
import { onBeforeUnmount, ref } from 'vue';
import * as ordersApi from '@/api/orders';
import type { Order } from '@/types';

export function useOrderPolling() {
  const order = ref<Order | null>(null);
  const state = ref<'idle' | 'polling' | 'paid' | 'failed' | 'timeout'>('idle');
  let timer: ReturnType<typeof setTimeout> | null = null;
  let tries = 0;

  async function tick(sessionId: string) {
    tries++;
    try {
      order.value = await ordersApi.bySession(sessionId);
      if (order.value.status === 'PAID') return void (state.value = 'paid');
      if (order.value.status === 'FAILED') return void (state.value = 'failed');
    } catch {
      /* not visible yet */
    }
    if (tries >= 45) return void (state.value = 'timeout');
    timer = setTimeout(() => void tick(sessionId), 2000);
  }

  function start(sessionId: string) {
    state.value = 'polling';
    tries = 0;
    void tick(sessionId);
  }

  onBeforeUnmount(() => timer && clearTimeout(timer));
  return { order, state, start };
}
