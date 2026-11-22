<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import ImageUpload from '@/components/admin/ImageUpload.vue';
import * as api from '@/api/admin/certificateTemplate';
import { errorMessage } from '@/api/client';
const t = ref<api.CertificateTemplate | null>(null);
const preview = ref('');
const busy = ref(false);
const err = ref('');
onMounted(async () => {
  t.value = await api.getTemplate();
  preview.value = api.previewUrl();
});
async function save() {
  busy.value = true;
  err.value = '';
  try {
    t.value = await api.saveTemplate(t.value!);
    preview.value = api.previewUrl();
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Certificate template" subtitle="One template for every course. The layout is fixed; you can change the text, logo, signature and colour.">
      <v-btn v-if="t" color="primary" :loading="busy" @click="save">Save template</v-btn>
    </AdminPageHeader>
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <v-skeleton-loader v-if="!t" type="article" color="surface" />
    <div v-else class="cert-split">
      <section class="panel pa-6 d-flex flex-column ga-1 settings" aria-label="Template settings">
        <v-text-field v-model="t.heading" label="Heading" />
        <v-text-field v-model="t.issuerName" label="Issuer name" />
        <v-text-field v-model="t.signerName" label="Signer name" placeholder="Name of the person who signs" />
        <v-text-field v-model="t.signerTitle" label="Signer title" placeholder="Job title" />
        <ImageUpload v-model="t.logoUrl" kind="logo" label="Logo" :aspect="3" class="mb-4" />
        <ImageUpload v-model="t.signatureUrl" kind="signature" label="Signature image" :aspect="3" class="mb-4" />
        <div class="d-flex align-center ga-3">
          <label for="c-col" class="text-body-2 font-weight-medium">Accent colour</label>
          <input id="c-col" v-model="t.primaryColor" type="color" class="swatch" />
          <span class="mono text-body-2 text-muted">{{ t.primaryColor }}</span>
        </div>
      </section>
      <section class="panel pa-5 d-flex flex-column ga-3 preview" aria-label="Preview">
        <span class="text-caption text-muted font-weight-bold text-uppercase" style="letter-spacing: 0.06em">Preview</span>
        <iframe :key="preview" :src="preview" title="Certificate preview" class="frame" />
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
  border-radius: 4px;
  background: #fff;
}
.swatch {
  width: 44px;
  height: 36px;
  padding: 2px;
  border: 1px solid var(--ot-input-border);
  border-radius: 4px;
  background: var(--ot-surface);
  cursor: pointer;
}
</style>
