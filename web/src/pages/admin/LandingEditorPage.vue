<script setup lang="ts">
// Home page CMS: banners (add, reorder, hide, delete), hero texts, partner logo section, footer contact.
import { computed, onMounted, ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import ImageUpload from '@/components/admin/ImageUpload.vue';
import * as api from '@/api/admin/landing';
import { errorMessage } from '@/api/client';
import { useLanding } from '@/composables/useLanding';

const banners = ref<api.Banner[]>([]);
const sections = ref<api.Section[]>([]);
const newImg = ref<string | null>(null);
const newLink = ref('');
const newAlt = ref('');
const err = ref('');
const ok = ref(false);
const adding = ref(false);
const { load: reloadLanding } = useLanding();

async function load() {
  [banners.value, sections.value] = await Promise.all([api.banners(), api.sections()]);
  for (const key of ['hero', 'partners', 'footer']) if (!sections.value.find((s) => s.key === key)) sections.value.push({ key, content: {}, isVisible: true, order: sections.value.length });
}
onMounted(load);
const sec = (k: string) => computed(() => sections.value.find((s) => s.key === k)!);
const hero = sec('hero');
const partners = sec('partners');
const footer = sec('footer');
const field = (s: api.Section, k: string) => String(s.content[k] ?? '');

async function addBanner() {
  if (!newImg.value) return;
  try {
    await api.addBanner({ imageUrl: newImg.value, linkUrl: newLink.value || null, altText: newAlt.value || null, isActive: true });
    newImg.value = null;
    newLink.value = '';
    newAlt.value = '';
    await load();
  } catch (e) {
    err.value = errorMessage(e);
  }
}
async function toggle(b: api.Banner) {
  await api.updateBanner(b.id, { isActive: !b.isActive });
  await load();
}
async function removeBanner(b: api.Banner) {
  await api.removeBanner(b.id);
  await load();
}
async function move(i: number, d: -1 | 1) {
  const ids = banners.value.map((b) => b.id);
  const j = i + d;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  banners.value = await api.reorderBanners(ids);
}
async function saveSections() {
  err.value = '';
  try {
    sections.value = await api.saveSections(sections.value);
    ok.value = true;
    void reloadLanding(true);
  } catch (e) {
    err.value = errorMessage(e);
  }
}
function setField(s: api.Section, k: string, v: string) {
  s.content = { ...s.content, [k]: v };
}
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Landing page" subtitle="Manage the home page banners and text.">
      <v-btn variant="outlined" to="/">Preview home page</v-btn>
      <v-btn v-if="hero && footer && partners" color="primary" @click="saveSections">Save changes</v-btn>
    </AdminPageHeader>
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>

    <section class="panel pa-6 d-flex flex-column ga-4" aria-labelledby="ban-h">
      <div class="d-flex flex-wrap align-center justify-space-between ga-3">
        <h2 id="ban-h" class="h2">Banners</h2>
        <v-btn :variant="adding ? 'outlined' : 'flat'" :color="adding ? undefined : 'primary'" @click="adding = !adding">{{ adding ? 'Cancel' : '+ Add banner' }}</v-btn>
      </div>
      <div v-if="adding" class="add-box">
        <ImageUpload v-model="newImg" kind="banner" :aspect="3.2" label="Banner image" />
        <div class="d-flex flex-column ga-1" style="flex: 1 1 260px; min-width: 0">
          <v-text-field v-model="newAlt" label="Description (for screen readers)" />
          <v-text-field v-model="newLink" label="Link (optional)" placeholder="https:// or /courses/..." />
          <v-btn color="primary" :disabled="!newImg" class="align-self-start" @click="addBanner(), (adding = false)">Add banner</v-btn>
        </div>
      </div>
      <div v-if="!banners.length" class="text-body-2 text-muted">No banners. The home page shows the headline below instead.</div>
      <ol v-else class="rows">
        <li v-for="(b, i) in banners" :key="b.id">
          <span class="order">
            <button type="button" class="arrow" :disabled="i === 0" :aria-label="`Move banner ${i + 1} up`" @click="move(i, -1)">▲</button>
            <button type="button" class="arrow" :disabled="i === banners.length - 1" :aria-label="`Move banner ${i + 1} down`" @click="move(i, 1)">▼</button>
          </span>
          <span class="thumb" :style="{ opacity: b.isActive ? 1 : 0.45 }"><img :src="b.imageUrl" alt="" /></span>
          <span class="info">
            <span class="d-block font-weight-bold text-truncate">{{ b.altText || `Banner ${i + 1}` }}</span>
            <span class="d-block text-caption text-muted text-truncate">Links to: {{ b.linkUrl || 'nothing' }}</span>
          </span>
          <StatusPill :label="b.isActive ? 'Showing' : 'Hidden'" :tone="b.isActive ? 'success' : 'neutral'" />
          <span class="text-no-wrap">
            <button type="button" class="row-link" @click="toggle(b)">{{ b.isActive ? 'Hide' : 'Show' }}</button>
            <button type="button" class="row-link danger" @click="removeBanner(b)">Delete</button>
          </span>
        </li>
      </ol>
      <p class="ma-0 text-caption text-muted">Recommended size 1600 × 500 px. Banners show in this order on the home page.</p>
    </section>

    <template v-if="hero && footer && partners">
      <section class="panel pa-6 d-flex flex-column ga-1" aria-labelledby="hero-h">
        <h2 id="hero-h" class="h2 mb-1">Home page text</h2>
        <p class="text-caption text-muted mb-3">Shown at the top of the home page when there are no banners.</p>
        <v-text-field :model-value="field(hero, 'title')" label="Headline" @update:model-value="setField(hero, 'title', $event)" />
        <v-textarea :model-value="field(hero, 'subtitle')" label="Subtext" rows="2" auto-grow @update:model-value="setField(hero, 'subtitle', $event)" />
      </section>

      <section class="panel pa-6 d-flex flex-column ga-3" aria-labelledby="sec-h">
        <h2 id="sec-h" class="h2">Sections on the home page</h2>
        <ul class="rows">
          <li>
            <span class="info font-weight-medium">Partner logos</span>
            <span class="text-caption text-muted d-none d-sm-inline">Which logos and their order are set on the Partners page.</span>
            <v-switch v-model="partners.isVisible" color="primary" hide-details density="compact" :label="partners.isVisible ? 'Visible' : 'Hidden'" class="flex-grow-0" />
          </li>
        </ul>
      </section>

      <section class="panel pa-6 d-flex flex-column ga-1" aria-labelledby="ft-h">
        <h2 id="ft-h" class="h2 mb-3">Footer and company info</h2>
        <div class="grid2">
          <v-text-field :model-value="field(footer, 'companyName')" label="Company name" @update:model-value="setField(footer, 'companyName', $event)" />
          <v-text-field :model-value="field(footer, 'phone')" label="Phone" placeholder="Phone number" @update:model-value="setField(footer, 'phone', $event)" />
          <v-text-field :model-value="field(footer, 'email')" label="Email" placeholder="Email address" @update:model-value="setField(footer, 'email', $event)" />
          <v-text-field :model-value="field(footer, 'website')" label="Website" placeholder="Website URL" @update:model-value="setField(footer, 'website', $event)" />
        </div>
        <v-textarea :model-value="field(footer, 'address')" label="Address" rows="2" auto-grow placeholder="Company address" @update:model-value="setField(footer, 'address', $event)" />
      </section>
    </template>
    <v-snackbar v-model="ok" :timeout="2500">Saved</v-snackbar>
  </div>
</template>

<style scoped>
.h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.add-box {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-start;
  padding: 16px;
  border: 1px dashed var(--ot-input-border);
  border-radius: 4px;
  background: var(--ot-bg);
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
}
.rows li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-top: 1px solid var(--ot-border);
}
.rows li:last-child {
  border-bottom: 1px solid var(--ot-border);
}
.order {
  display: flex;
  flex-direction: column;
}
.arrow {
  width: 24px;
  height: 18px;
  border: 0;
  background: none;
  cursor: pointer;
  font-size: 9px;
  color: var(--ot-muted);
}
.arrow:disabled {
  opacity: 0.3;
  cursor: default;
}
.thumb {
  width: 128px;
  height: 40px;
  flex: none;
  border-radius: 3px;
  background: var(--ot-thumb);
  overflow: hidden;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.info {
  flex: 1 1 200px;
  min-width: 0;
}
.grid2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  column-gap: 16px;
}
</style>
