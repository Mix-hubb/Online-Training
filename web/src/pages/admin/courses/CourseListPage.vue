<script setup lang="ts">
// Admin course list (mockup AdminCourses): search, status + category filters, table with Edit / Preview / Delete.
// Pins (admin-only, 2026-11-22): pin toggle per row (PUBLISHED only) and a drag-to-reorder list of pinned courses.
// Learners see pinned courses first in the catalog, with no label.
import { onMounted, ref, watch } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import * as api from '@/api/admin/courses';
import * as taxonomy from '@/api/admin/taxonomy';
import { errorMessage } from '@/api/client';
import type { Paged } from '@/types';
import { date, priceLabel } from '@/utils/format';

const q = ref({ q: '', status: '', category: '', page: 1 });
const data = ref<Paged<api.AdminCourseRow> | null>(null);
const categories = ref<taxonomy.TaxonRow[]>([]);
const toDelete = ref<api.AdminCourseRow | null>(null);
const confirm = ref(false);
const busy = ref(false);
const err = ref('');
const pinned = ref<api.PinnedCourse[]>([]);
const pinBusy = ref(false);
async function load() {
  data.value = await api.list({ ...q.value, category: q.value.category || undefined });
}
async function loadPins() {
  pinned.value = await api.pins().catch(() => []);
}
async function pinCall(fn: () => Promise<api.PinnedCourse[]>) {
  pinBusy.value = true;
  err.value = '';
  try {
    pinned.value = await fn();
    await load();
  } catch (e) {
    err.value = errorMessage(e);
    await loadPins();
  } finally {
    pinBusy.value = false;
  }
}
const togglePin = (c: api.AdminCourseRow) => pinCall(() => (c.pinOrder === null ? api.pin(c.id) : api.unpin(c.id)));
function move(from: number, to: number) {
  if (to < 0 || to >= pinned.value.length || from === to) return;
  const list = [...pinned.value];
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  pinned.value = list;
  void pinCall(() => api.reorderPins(list.map((p) => p.id)));
}
const dragFrom = ref<number | null>(null);
const dragOver = ref<number | null>(null);
function onDrop(i: number) {
  if (dragFrom.value !== null) move(dragFrom.value, i);
  dragFrom.value = dragOver.value = null;
}
onMounted(async () => {
  void load();
  void loadPins();
  categories.value = await taxonomy.categories().catch(() => []);
});
let t: ReturnType<typeof setTimeout> | undefined;
watch(
  () => [q.value.q, q.value.status, q.value.category],
  () => {
    q.value.page = 1;
    clearTimeout(t);
    t = setTimeout(load, 250);
  },
);
watch(() => q.value.page, load);
const tone = (s: string) => (s === 'PUBLISHED' ? 'success' : s === 'DRAFT' ? 'warning' : 'neutral');
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
function askDelete(c: api.AdminCourseRow) {
  err.value = '';
  toDelete.value = c;
  confirm.value = true;
}
async function doDelete() {
  if (!toDelete.value) return;
  busy.value = true;
  try {
    await api.remove(toDelete.value.id);
    confirm.value = false;
    await load();
  } catch (e) {
    err.value = errorMessage(e);
    confirm.value = false;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Courses" subtitle="Create, edit and publish courses.">
      <v-btn color="primary" prepend-icon="mdi-plus" to="/admin/courses/new">New course</v-btn>
    </AdminPageHeader>

    <div class="filters">
      <div class="grow2"><label for="aq" class="sr-only">Search courses</label><input id="aq" v-model="q.q" type="search" class="ot-input" placeholder="Search by title" /></div>
      <div class="grow1">
        <label for="as" class="sr-only">Status</label>
        <select id="as" v-model="q.status" class="ot-select">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>
      <div class="grow1">
        <label for="ac" class="sr-only">Category</label>
        <select id="ac" v-model="q.category" class="ot-select">
          <option value="">All categories</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
    </div>
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>

    <section class="panel pa-5 d-flex flex-column ga-3" aria-labelledby="pins-h">
      <div class="d-flex flex-wrap align-center justify-space-between ga-2">
        <h2 id="pins-h" class="pins-h">Pinned courses</h2>
        <span class="text-body-2 text-muted">Shown first in the learner catalog, in this order. Learners see no label. Drag to reorder.</span>
      </div>
      <p v-if="!pinned.length" class="text-body-2 text-muted ma-0">No pinned courses. Use the pin button on a published course below.</p>
      <ol v-else class="pins" :aria-busy="pinBusy">
        <li
          v-for="(p, i) in pinned"
          :key="p.id"
          class="pin-row"
          :class="{ over: dragOver === i && dragFrom !== i }"
          draggable="true"
          @dragstart="dragFrom = i"
          @dragover.prevent="dragOver = i"
          @dragleave="dragOver = null"
          @drop.prevent="onDrop(i)"
          @dragend="dragFrom = dragOver = null"
        >
          <v-icon icon="mdi-drag-vertical" size="20" class="grip" aria-hidden="true" />
          <span class="num">{{ i + 1 }}</span>
          <span class="cthumb sm"><img v-if="p.thumbnailUrl" :src="p.thumbnailUrl" alt="" /></span>
          <span class="flex-grow-1 font-weight-medium pin-title">{{ p.title }}</span>
          <button type="button" class="icon-btn" :disabled="pinBusy || i === 0" :aria-label="`Move ${p.title} up`" @click="move(i, i - 1)"><v-icon icon="mdi-chevron-up" size="18" /></button>
          <button type="button" class="icon-btn" :disabled="pinBusy || i === pinned.length - 1" :aria-label="`Move ${p.title} down`" @click="move(i, i + 1)"><v-icon icon="mdi-chevron-down" size="18" /></button>
          <button type="button" class="row-link danger" :disabled="pinBusy" @click="pinCall(() => api.unpin(p.id))">Unpin</button>
        </li>
      </ol>
    </section>

    <v-skeleton-loader v-if="!data" type="table" color="surface" />
    <div v-else-if="!data.items.length" class="panel pa-10 text-center text-body-2 text-muted">No courses match. Create a new one.</div>
    <div v-else class="table-scroll">
      <table class="data-table" style="min-width: 900px">
        <caption class="sr-only">All courses</caption>
        <thead>
          <tr>
            <th scope="col"><span class="sr-only">Pin</span></th>
            <th scope="col">Course</th>
            <th scope="col">Price</th>
            <th scope="col">Status</th>
            <th scope="col">Learners</th>
            <th scope="col">Updated</th>
            <th scope="col" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in data.items" :key="c.id">
            <td class="pin-cell">
              <button
                type="button"
                class="icon-btn"
                :class="{ on: c.pinOrder !== null }"
                :disabled="pinBusy || (c.pinOrder === null && c.status !== 'PUBLISHED')"
                :aria-pressed="c.pinOrder !== null"
                :aria-label="c.pinOrder !== null ? `Unpin ${c.title}` : `Pin ${c.title}`"
                :title="c.pinOrder === null && c.status !== 'PUBLISHED' ? 'Only published courses can be pinned' : c.pinOrder !== null ? 'Unpin' : 'Pin to the top of the catalog'"
                @click="togglePin(c)"
              >
                <v-icon :icon="c.pinOrder !== null ? 'mdi-pin' : 'mdi-pin-outline'" size="18" />
              </button>
            </td>
            <td>
              <div class="d-flex align-center ga-4">
                <span class="cthumb"><img v-if="c.thumbnailUrl" :src="c.thumbnailUrl" alt="" /></span>
                <div>
                  <div class="font-weight-bold">{{ c.title }}</div>
                  <div class="text-caption text-muted mt-1">{{ c.category ?? 'No category' }} · {{ c.lessons }} {{ c.lessons === 1 ? 'lesson' : 'lessons' }}</div>
                </div>
              </div>
            </td>
            <td class="text-no-wrap">{{ priceLabel(c) }}</td>
            <td><StatusPill :label="label(c.status)" :tone="tone(c.status)" /></td>
            <td>{{ c.learners }}</td>
            <td class="text-no-wrap text-muted">{{ date(c.updatedAt) }}</td>
            <td class="text-right text-no-wrap">
              <router-link :to="`/admin/courses/${c.id}`" class="row-btn">Edit</router-link>
              <router-link :to="`/admin/courses/${c.id}/preview`" class="row-link">Preview</router-link>
              <button type="button" class="row-link danger" :disabled="c.learners > 0" :title="c.learners > 0 ? 'Courses with learners can only be archived' : undefined" @click="askDelete(c)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <v-pagination v-if="data && data.pages > 1" v-model="q.page" :length="data.pages" density="comfortable" />
    <p class="list-note">Archive a course to hide it from the catalog and stop new sales. People who already own it keep access. Delete is only for courses without learners or orders.</p>

    <ConfirmDialog v-model="confirm" title="Delete this course?" confirm-label="Delete" danger :loading="busy" @confirm="doDelete">
      <strong>{{ toDelete?.title }}</strong> and its lessons will be removed. This cannot be undone.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.pins-h {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.pins {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pin-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--ot-border);
  border-radius: 4px;
  background: var(--ot-surface);
  cursor: grab;
}
.pin-row.over {
  border-color: var(--ot-accent);
  background: var(--ot-accent-tint);
}
.pin-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grip {
  color: var(--ot-muted);
}
.num {
  width: 24px;
  height: 24px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
  font-size: 12px;
  font-weight: 600;
}
.icon-btn {
  width: 36px;
  height: 36px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ot-border);
  border-radius: 4px;
  background: var(--ot-surface);
  color: var(--ot-muted);
  cursor: pointer;
}
.icon-btn.on {
  color: var(--ot-accent-strong);
  background: var(--ot-accent-tint);
  border-color: var(--ot-accent-tint);
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.icon-btn:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: 2px;
}
.pin-cell {
  width: 52px;
}
.cthumb.sm {
  width: 48px;
  height: 30px;
}
.cthumb {
  width: 64px;
  height: 40px;
  flex: none;
  border-radius: 3px;
  background: var(--ot-thumb);
  overflow: hidden;
}
.cthumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
