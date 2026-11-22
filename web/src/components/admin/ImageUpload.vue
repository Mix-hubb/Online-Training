<script setup lang="ts">
// Upload an image to /admin/uploads (jpg/png/webp, 5 MB) and emit its public URL.
import { ref } from 'vue';
import * as landingApi from '@/api/admin/landing';
import { errorMessage, fileToBase64 } from '@/api/client';

const url = defineModel<string | null>({ default: null });
const props = defineProps<{ kind: 'cover' | 'banner' | 'logo' | 'signature' | 'other'; label?: string; aspect?: number }>();
const input = ref<HTMLInputElement | null>(null);
const busy = ref(false);
const err = ref('');
async function pick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!f) return;
  err.value = '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return void (err.value = 'Use JPG, PNG or WebP.');
  if (f.size > 5 * 1024 * 1024) return void (err.value = 'Max 5 MB.');
  busy.value = true;
  try {
    url.value = (await landingApi.uploadImage({ name: f.name, dataBase64: await fileToBase64(f) }, props.kind)).url;
  } catch (x) {
    err.value = errorMessage(x);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <div v-if="label" class="text-body-2 mb-2">{{ label }}</div>
    <div class="d-flex ga-3 align-center">
      <v-img v-if="url" :src="url" :aspect-ratio="aspect ?? 1.7778" width="200" max-width="200" cover class="rounded border-subtle flex-grow-0" />
      <div v-else class="ph rounded d-flex align-center justify-center text-caption text-muted" :style="{ aspectRatio: String(aspect ?? 1.7778) }">No image</div>
      <div class="d-flex flex-column ga-2">
        <v-btn size="small" variant="outlined" :loading="busy" prepend-icon="mdi-upload" @click="input?.click()">{{ url ? 'Replace' : 'Upload' }}</v-btn>
        <v-btn v-if="url" size="small" variant="text" color="error" @click="url = null">Remove</v-btn>
      </div>
      <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="pick" />
    </div>
    <div v-if="err" class="text-caption text-error mt-1">{{ err }}</div>
  </div>
</template>

<style scoped>
.ph {
  width: 200px;
  border: 1px dashed var(--ot-input-border);
}
</style>
