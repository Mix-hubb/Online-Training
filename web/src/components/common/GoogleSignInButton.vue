<script setup lang="ts">
// Google sign-in (Google Identity Services). Hidden when VITE_GOOGLE_CLIENT_ID is not set.
import { onMounted, ref } from 'vue';

const emit = defineEmits<{ credential: [string] }>();
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const el = ref<HTMLDivElement | null>(null);

interface GoogleId {
  accounts: { id: { initialize(o: unknown): void; renderButton(el: HTMLElement, o: unknown): void } };
}

onMounted(() => {
  if (!clientId || !el.value) return;
  const render = () => {
    const g = (window as unknown as { google?: GoogleId }).google;
    if (!g || !el.value) return;
    g.accounts.id.initialize({ client_id: clientId, callback: (r: { credential: string }) => emit('credential', r.credential) });
    g.accounts.id.renderButton(el.value, { theme: 'outline', size: 'large', width: 320, text: 'continue_with', shape: 'rectangular' });
  };
  if ((window as unknown as { google?: GoogleId }).google) return render();
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.onload = render;
  document.head.appendChild(s);
});
</script>

<template>
  <div v-if="clientId">
    <div class="or-line mb-4">or</div>
    <div ref="el" class="d-flex justify-center" />
  </div>
</template>
