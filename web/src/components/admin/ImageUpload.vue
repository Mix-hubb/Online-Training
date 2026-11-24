<script setup lang="ts">
// Upload an image to /admin/uploads (jpg/png/webp) and emit its public URL.
// Banners and covers (2026-11-24): up to 15 MB, a recommended size is shown, and the admin is warned
// when the picked image is too small to look sharp on large or high-res screens (the server never enlarges).
import { computed, ref } from 'vue';
import * as landingApi from '@/api/admin/landing';
import { errorMessage, fileToBase64 } from '@/api/client';

const url = defineModel<string | null>({ default: null });
const props = defineProps<{ kind: 'cover' | 'banner' | 'logo' | 'signature' | 'other'; label?: string; aspect?: number }>();
const input = ref<HTMLInputElement | null>(null);
const busy = ref(false);
const err = ref('');
const small = ref<{ w: number; h: number } | null>(null);

// Must match api/src/lib/attachments.ts (MAX_ADMIN_IMAGE_BYTES).
const MAX_MB = 15;
/** Narrower than this looks soft on a laptop or tablet screen. */
const MIN_WIDTH: Partial<Record<typeof props.kind, number>> = { banner: 1920, cover: 1280 };
const minWidth = computed(() => MIN_WIDTH[props.kind]);
const hint = computed(() =>
  props.kind === 'banner'
    ? 'Best: 16:9, 2400 × 1350 px or larger (at least 1920 px wide). Keep the subject near the middle. JPG, PNG or WebP, up to 15 MB.'
    : props.kind === 'cover'
      ? 'Best: 1920 × 1080 px (at least 1280 px wide). JPG, PNG or WebP, up to 15 MB.'
      : `JPG, PNG or WebP, up to ${MAX_MB} MB.`,
);

function measure(f: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const src = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(src);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(src);
    };
    img.src = src;
  });
}

async function pick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!f) return;
  err.value = '';
  small.value = null;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return void (err.value = 'Use JPG, PNG or WebP.');
  if (f.size > MAX_MB * 1024 * 1024) return void (err.value = `Max ${MAX_MB} MB.`);
  busy.value = true;
  try {
    const size = await measure(f);
    url.value = (await landingApi.uploadImage({ name: f.name, dataBase64: await fileToBase64(f) }, props.kind)).url;
    if (size && minWidth.value && size.w < minWidth.value) small.value = size;
  } catch (x) {
    err.value = errorMessage(x);
  } finally {
    busy.value = false;
  }
}
function remove() {
  url.value = null;
  small.value = null;
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
        <v-btn v-if="url" size="small" variant="text" color="error" @click="remove">Remove</v-btn>
      </div>
      <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="pick" />
    </div>
    <div class="text-caption text-muted mt-2">{{ hint }}</div>
    <div v-if="small" class="callout warning mt-2" role="status">
      This image is {{ small.w }} × {{ small.h }} px, so it may look blurry on large or high-resolution screens.
      For a sharp {{ kind }}, upload one at least {{ minWidth }} px wide.
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
