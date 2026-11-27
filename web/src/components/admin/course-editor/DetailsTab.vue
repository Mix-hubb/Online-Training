<script setup lang="ts">
// Course details form. Prices are typed in major units (e.g. 49.00) and stored in minor units.
import { onMounted, ref, watch } from 'vue';
import ImageUpload from '@/components/admin/ImageUpload.vue';
import VideoUpload from '@/components/admin/VideoUpload.vue';
import * as api from '@/api/admin/courses';
// Public lists: instructors use this editor too and cannot open the admin taxonomy routes.
import * as catalog from '@/api/catalog';
import type { Taxon } from '@/types';
import { errorMessage } from '@/api/client';
import type { Level } from '@/types';

const props = defineProps<{ course: api.AdminCourse | null }>();
const emit = defineEmits<{ saved: [api.AdminCourse] }>();
const f = ref({
  title: '',
  summary: '',
  description: '',
  thumbnailUrl: null as string | null,
  level: 'BEGINNER' as Level,
  categoryId: null as string | null,
  tagIds: [] as string[],
  isFree: false,
  price: '',
  priceThb: '',
  allow4k: false,
});
const outcomes = ref<string[]>(['']);
const cats = ref<Taxon[]>([]);
const tags = ref<Taxon[]>([]);
const busy = ref(false);
const err = ref('');
const ok = ref(false);

watch(
  () => props.course,
  (c) => {
    if (!c) return;
    outcomes.value = c.outcomes.length ? [...c.outcomes] : [''];
    f.value = {
      title: c.title,
      summary: c.summary,
      description: c.description,
      thumbnailUrl: c.thumbnailUrl,
      level: c.level,
      categoryId: c.categoryId,
      tagIds: c.tags.map((t) => t.id),
      isFree: c.isFree,
      price: c.priceMinor ? (c.priceMinor / 100).toFixed(2) : '',
      priceThb: c.priceThbMinor ? (c.priceThbMinor / 100).toFixed(2) : '',
      allow4k: c.allow4k,
    };
  },
  { immediate: true },
);
onMounted(async () => {
  [cats.value, tags.value] = await Promise.all([catalog.categories(), catalog.tags()]);
});
const toMinor = (s: string) => (s.trim() ? Math.round(Number(s) * 100) : 0);

async function save() {
  err.value = '';
  if (!f.value.title.trim()) return void (err.value = 'Add a title.');
  if (!f.value.isFree && toMinor(f.value.price) <= 0 && toMinor(f.value.priceThb) <= 0) return void (err.value = 'Set a price, or mark the course free.');
  busy.value = true;
  const input: api.CourseInput = {
    title: f.value.title.trim(),
    summary: f.value.summary,
    description: f.value.description,
    outcomes: outcomes.value.map((s) => s.trim()).filter(Boolean),
    thumbnailUrl: f.value.thumbnailUrl,
    level: f.value.level,
    categoryId: f.value.categoryId,
    tagIds: f.value.tagIds,
    isFree: f.value.isFree,
    priceMinor: f.value.isFree ? 0 : toMinor(f.value.price),
    priceThbMinor: f.value.isFree ? null : toMinor(f.value.priceThb) || null,
    allow4k: f.value.allow4k,
  };
  try {
    const c = props.course ? await api.update(props.course.id, input) : await api.create(input);
    ok.value = true;
    emit('saved', c);
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="d-flex flex-column ga-4">
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <div class="ed-split">
      <section class="panel pa-6 d-flex flex-column ga-1 ed-main" aria-label="Course details">
        <v-text-field v-model="f.title" label="Title" maxlength="150" counter />
        <v-textarea v-model="f.summary" label="Short summary (card text)" rows="2" auto-grow maxlength="300" counter />
        <v-textarea v-model="f.description" label="Full description" rows="5" auto-grow placeholder="Describe the course" />
        <div class="d-flex flex-wrap ga-4">
          <v-select v-model="f.categoryId" label="Category" clearable :items="cats.map((c) => ({ title: c.name, value: c.id }))" style="flex: 1 1 180px" />
          <v-select v-model="f.level" label="Level" :items="[{ title: 'Beginner', value: 'BEGINNER' }, { title: 'Intermediate', value: 'INTERMEDIATE' }, { title: 'Advanced', value: 'ADVANCED' }]" style="flex: 1 1 180px" />
        </div>
        <v-autocomplete v-model="f.tagIds" label="Tags" variant="outlined" multiple chips closable-chips :items="tags.map((t) => ({ title: t.name, value: t.id }))" />
        <div class="d-flex flex-column ga-2">
          <span class="lbl">What learners will learn</span>
          <div v-for="(o, i) in outcomes" :key="i" class="outcome">
            <label :for="`oc-${i}`" class="sr-only">Learning point {{ i + 1 }}</label>
            <input :id="`oc-${i}`" v-model="outcomes[i]" type="text" class="bare" placeholder="One thing learners will be able to do" />
            <button type="button" class="row-link" @click="outcomes.splice(i, 1)">Remove</button>
          </div>
          <button type="button" class="add-link" @click="outcomes.push('')">+ Add item</button>
        </div>
      </section>

      <aside class="ed-aside">
        <section class="panel pa-5 d-flex flex-column ga-3" aria-labelledby="price-h">
          <h2 id="price-h" class="h3">Pricing</h2>
          <div role="radiogroup" aria-label="Pricing type" class="seg">
            <button type="button" role="radio" :aria-checked="f.isFree" @click="f.isFree = true">Free</button>
            <button type="button" role="radio" :aria-checked="!f.isFree" @click="f.isFree = false">Paid</button>
          </div>
          <template v-if="!f.isFree">
            <v-text-field v-model="f.price" label="Price (USD)" type="number" min="0" step="0.01" prefix="$" hint="Card payments" persistent-hint />
            <v-text-field v-model="f.priceThb" label="Price (THB, optional)" type="number" min="0" step="0.01" prefix="฿" hint="Needed for PromptPay and bank transfer" persistent-hint />
          </template>
          <span class="text-caption text-muted">{{ f.isFree ? 'Anyone with an account can start this course.' : 'Buyers keep the course for good. Payment methods depend on which prices are set.' }}</span>
        </section>
        <section class="panel pa-5 d-flex flex-column ga-3" aria-labelledby="cover-h">
          <h2 id="cover-h" class="h3">Cover image</h2>
          <ImageUpload v-model="f.thumbnailUrl" kind="cover" label="Cover image (16:9)" />
        </section>
        <section class="panel pa-5 d-flex flex-column ga-3" aria-labelledby="vid-h">
          <h2 id="vid-h" class="h3">Video</h2>
          <template v-if="course">
            <div class="d-flex align-center justify-space-between ga-2 text-body-2">
              <span class="text-muted">Introduction video</span>
              <span class="font-weight-bold" :style="{ color: course.introVideoId ? 'var(--ot-success)' : 'var(--ot-muted)' }">{{ course.introVideoId ? 'Uploaded' : 'None' }}</span>
            </div>
            <VideoUpload :init="() => api.introUploadInit(course!.id)" :label="course.introVideoId ? 'Replace video' : 'Upload intro video'" @uploaded="ok = true" />
          </template>
          <span v-else class="text-caption text-muted">Create the course first, then upload the intro video.</span>
          <v-switch v-model="f.allow4k" color="primary" hide-details density="compact" label="Allow 4K playback" />
          <span class="text-caption text-muted">Learners get up to 1080p by default. 4K raises storage and delivery cost; confirm with the client first.</span>
        </section>
      </aside>
    </div>
    <div class="d-flex justify-end">
      <v-btn color="primary" size="large" :loading="busy" @click="save">{{ course ? 'Save changes' : 'Create course' }}</v-btn>
    </div>
    <v-snackbar v-model="ok" :timeout="2500">Saved</v-snackbar>
  </div>
</template>

<style scoped>
.ed-split {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;
}
.ed-main {
  flex: 999 1 460px;
  min-width: 0;
}
.ed-aside {
  flex: 1 1 300px;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
@media (max-width: 860px) {
  .ed-aside {
    max-width: none;
  }
}
.h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.lbl {
  font-size: 13px;
  font-weight: 500;
}
.outcome {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px;
  border: 1px solid var(--ot-input-border);
  border-radius: var(--ot-radius-control);
  background: var(--ot-surface);
}
.outcome:focus-within {
  border-color: var(--ot-accent);
}
.bare {
  flex: 1;
  min-width: 0;
  height: var(--ot-control-h);
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ot-text);
  font: inherit;
  font-size: 14px;
}
.add-link {
  align-self: flex-start;
  min-height: var(--ot-control-h);
  padding: 0 var(--ot-space-1-5);
  margin-left: calc(-1 * var(--ot-space-1-5));
  border: 0;
  border-radius: var(--ot-radius-control);
  background: none;
  cursor: pointer;
  font-size: var(--ot-fs-sm);
  font-weight: 500;
  color: var(--ot-accent-strong);
  transition: background var(--ot-transition);
}
.add-link:hover {
  background: var(--ot-accent-hover);
}
.seg {
  display: flex;
  padding: 4px;
  border-radius: var(--ot-radius-control);
  background: var(--ot-bg);
  border: 1px solid var(--ot-border);
}
.seg button {
  flex: 1;
  height: var(--ot-control-h);
  border: 0;
  border-radius: var(--ot-radius-control);
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--ot-muted);
}
.seg button[aria-checked='true'] {
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
  font-weight: 600;
}
.seg button:focus-visible {
  outline: 2px solid var(--ot-accent);
}
</style>
