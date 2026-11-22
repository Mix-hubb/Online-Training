<script setup lang="ts">
// Direct upload to the video host. Bunny Stream: TUS with a server-made signature (no API key in the browser).
// Dev provider: plain PUT to the API, which discards the file.
import { ref } from 'vue';
import * as tus from 'tus-js-client';
import { errorMessage } from '@/api/client';
import type { UploadTarget } from '@/api/admin/lessons';

const props = defineProps<{ init: () => Promise<UploadTarget>; label?: string }>();
const emit = defineEmits<{ uploaded: [] }>();
const input = ref<HTMLInputElement | null>(null);
const progress = ref<number | null>(null);
const err = ref('');

async function pick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!file) return;
  err.value = '';
  if (!file.type.startsWith('video/')) return void (err.value = 'Choose a video file.');
  progress.value = 0;
  try {
    const t = await props.init();
    if (t.uploadHeaders) {
      await new Promise<void>((resolve, reject) => {
        const up = new tus.Upload(file, {
          endpoint: t.uploadUrl,
          retryDelays: [0, 3000, 5000, 10000],
          headers: t.uploadHeaders,
          metadata: { filetype: file.type, title: file.name },
          onProgress: (s, total) => (progress.value = Math.round((s / total) * 100)),
          onError: reject,
          onSuccess: () => resolve(),
        });
        up.start();
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        const x = new XMLHttpRequest();
        x.open('PUT', t.uploadUrl);
        x.withCredentials = true;
        x.upload.onprogress = (ev) => ev.lengthComputable && (progress.value = Math.round((ev.loaded / ev.total) * 100));
        x.onload = () => (x.status < 300 ? resolve() : reject(new Error(`Upload failed (${x.status})`)));
        x.onerror = () => reject(new Error('Upload failed'));
        x.send(file);
      });
    }
    progress.value = null;
    emit('uploaded');
  } catch (x) {
    progress.value = null;
    err.value = x instanceof Error ? x.message : errorMessage(x);
  }
}
</script>

<template>
  <div class="d-inline-flex flex-column">
    <v-btn size="small" variant="outlined" prepend-icon="mdi-video-plus-outline" :loading="progress !== null" @click="input?.click()">{{ label ?? 'Upload video' }}</v-btn>
    <v-progress-linear v-if="progress !== null" :model-value="progress" color="primary" height="4" class="mt-1" />
    <span v-if="err" class="text-caption text-error">{{ err }}</span>
    <input ref="input" type="file" accept="video/*" hidden @change="pick" />
  </div>
</template>
