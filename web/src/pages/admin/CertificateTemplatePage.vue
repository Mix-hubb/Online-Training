<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import ImageUpload from '@/components/admin/ImageUpload.vue';
import * as api from '@/api/admin/certificateTemplate';
import { errorMessage } from '@/api/client';
const t = ref<api.CertificateTemplate | null>(null);
const preview = ref('');
const previewErr = ref('');
const busy = ref(false);
const err = ref('');
async function loadPreview() {
  previewErr.value = '';
  try {
    const url = await api.previewBlobUrl();
    if (preview.value) URL.revokeObjectURL(preview.value);
    preview.value = url;
  } catch (e) {
    previewErr.value = errorMessage(e);
  }
}
onMounted(async () => {
  t.value = await api.getTemplate();
  void loadPreview();
});
onBeforeUnmount(() => {
  if (preview.value) URL.revokeObjectURL(preview.value);
});
async function save() {
  busy.value = true;
  err.value = '';
  try {
    t.value = await api.saveTemplate(t.value!);
    void loadPreview();
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Certificate template" subtitle="One template for every course. The layout is fixed; you can change the heading, issuer name, logo, stamp and accent colour.">
      <v-btn v-if="t" color="primary" :loading="busy" @click="save">Save template</v-btn>
    </AdminPageHeader>
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <v-skeleton-loader v-if="!t" type="article" color="surface" />
    <div v-else class="cert-split">
      <section class="panel pa-6 d-flex flex-column ga-1 settings" aria-label="Template settings">
        <v-text-field v-model="t.heading" label="Heading" />
        <v-text-field v-model="t.issuerName" label="Issuer name" hint="Shown in 'organized by …' and under the stamp." persistent-hint class="mb-2" />
        <ImageUpload v-model="t.logoUrl" kind="logo" label="Logo (top centre)" :aspect="1" class="mb-4" />
        <ImageUpload v-model="t.stampUrl" kind="signature" label="Stamp (PNG with a clear background)" :aspect="1" class="mb-4" />
        <div class="d-flex align-center ga-3">
          <label for="c-col" class="text-body-2 font-weight-medium">Accent colour</label>
          <input id="c-col" v-model="t.primaryColor" type="color" class="swatch" />
          <span class="mono text-body-2 text-muted">{{ t.primaryColor }}</span>
        </div>
      </section>
      <section class="panel pa-5 d-flex flex-column ga-3 preview" aria-label="Preview">
        <span class="text-caption text-muted font-weight-bold text-uppercase" style="letter-spacing: 0.06em">Preview</span>
        <iframe v-if="preview" :key="preview" :src="preview" title="Certificate preview" class="frame" />
        <div v-else-if="previewErr" class="callout danger" role="alert">{{ previewErr }} <button type="button" class="row-link" @click="loadPreview">Try again</button></div>
        <v-skeleton-loader v-else type="image" color="surface" class="frame" />
        <span class="text-caption text-muted">Save to refresh the preview.</span>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cert-split {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;
}
.settings {
  flex: 1 1 340px;
  max-width: 460px;
}
.preview {
  flex: 999 1 460px;
  min-width: 0;
}
.frame {
  width: 100%;
  height: 520px;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-control);
  background: var(--ot-surface);
}
.swatch {
  width: 44px;
  height: var(--ot-control-h);
  padding: 2px;
  border: 1px solid var(--ot-input-border);
  border-radius: var(--ot-radius-control);
  background: var(--ot-surface);
  cursor: pointer;
}
</style>
