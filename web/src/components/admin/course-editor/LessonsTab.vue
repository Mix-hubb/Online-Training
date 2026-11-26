<script setup lang="ts">
// Lessons: add, edit, delete, reorder, upload video, check processing status and renditions.
// Reorder (2026-11-26): drag a lesson by its grip (or focus the grip and press the up / down arrow keys).
// Touch screens cannot drag this way, so there the grip is replaced by up / down buttons (CSS: pointer: coarse).
// The list moves at once on screen; the new order is saved in the background, one save at a time so the last
// order wins. If a save fails the error shows and the list is reloaded from the server.
import { nextTick, ref, watch } from 'vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import VideoUpload from '@/components/admin/VideoUpload.vue';
import * as api from '@/api/admin/lessons';
import type { AdminCourse, AdminLesson } from '@/api/admin/courses';
import { errorMessage } from '@/api/client';
import { duration } from '@/utils/format';

const props = defineProps<{ course: AdminCourse }>();
const emit = defineEmits<{ changed: [] }>();
const edit = ref<{ id: string | null; title: string; description: string; attachments: string } | null>(null);
const del = ref<AdminLesson | null>(null);
const busy = ref(false);
const err = ref('');

function openNew() {
  edit.value = { id: null, title: '', description: '', attachments: '' };
}
function openEdit(l: AdminLesson) {
  edit.value = { id: l.id, title: l.title, description: l.description ?? '', attachments: l.attachmentUrls.join('\n') };
}
async function save() {
  if (!edit.value || !edit.value.title.trim()) return;
  busy.value = true;
  err.value = '';
  try {
    const attachmentUrls = edit.value.attachments.split('\n').map((s) => s.trim()).filter(Boolean);
    if (edit.value.id) await api.update(edit.value.id, { title: edit.value.title.trim(), description: edit.value.description || null, attachmentUrls });
    else {
      const l = await api.create(props.course.id, { title: edit.value.title.trim(), description: edit.value.description || null });
      if (attachmentUrls.length) await api.update(l.id, { attachmentUrls });
    }
    edit.value = null;
    emit('changed');
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (!del.value) return;
  busy.value = true;
  try {
    await api.remove(del.value.id);
    del.value = null;
    emit('changed');
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
const list = ref<AdminLesson[]>([...props.course.lessons]);
const dragId = ref<string | null>(null); // lesson being dragged
const armed = ref<string | null>(null); // grip pressed: only then is the row draggable (text and buttons stay clickable)
let pending = 0;
let chain: Promise<unknown> = Promise.resolve();
let before = '';

// Take the server's list unless the admin is in the middle of a drag or a save is on its way.
watch(
  () => props.course.lessons,
  (v) => {
    if (!dragId.value && !pending) list.value = [...v];
  },
);

const key = () => list.value.map((l) => l.id).join(',');
function saveOrder() {
  const ids = list.value.map((l) => l.id);
  err.value = '';
  pending++;
  chain = chain
    .then(() => api.reorder(props.course.id, ids))
    .catch((e) => {
      err.value = errorMessage(e);
    })
    .finally(() => {
      // Last save done: let the editor reload the course quietly so other tabs see the same order.
      if (--pending === 0) emit('changed');
    });
}
function shift(from: number, to: number) {
  if (from === to || to < 0 || to >= list.value.length) return false;
  const next = [...list.value];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  list.value = next;
  return true;
}
function onDragStart(e: DragEvent, l: AdminLesson) {
  dragId.value = l.id;
  before = key();
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', l.id);
  }
}
function onDragEnter(i: number) {
  if (!dragId.value) return;
  shift(list.value.findIndex((l) => l.id === dragId.value), i);
}
function onDragEnd() {
  armed.value = dragId.value = null;
  if (key() !== before) saveOrder();
}
async function nudge(i: number, dir: -1 | 1) {
  const id = list.value[i]!.id;
  if (!shift(i, i + dir)) return;
  saveOrder();
  await nextTick();
  document.querySelector<HTMLElement>(`[data-grip="${id}"]`)?.focus();
}
async function checkStatus(l: AdminLesson) {
  await api.videoStatus(l.id).catch(() => undefined);
  emit('changed');
}
const tone = (s: string) => (s === 'READY' ? 'success' : s === 'FAILED' ? 'danger' : 'warning');
const vLabel = (s: string) => (s === 'READY' ? 'Ready' : s === 'FAILED' ? 'Failed, re-upload' : 'Processing');
const h = (x: number) => (x >= 2160 ? '4K' : `${x}p`);
</script>

<template>
  <section aria-label="Lessons" class="d-flex flex-column ga-4">
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <div class="d-flex flex-wrap align-center justify-space-between ga-3">
      <p class="ma-0 text-body-2 text-muted">Learners watch lessons in this order. Each one needs 90% watched before the next one opens. <span class="hint-mouse">Drag a lesson by its handle to move it.</span><span class="hint-touch">Use the arrows to move a lesson.</span></p>
      <v-btn color="primary" @click="openNew">+ Add lesson</v-btn>
    </div>
    <div v-if="!list.length" class="panel pa-10 text-center text-body-2 text-muted">No lessons yet. Add the first lesson, then upload its video.</div>
    <TransitionGroup v-else tag="ol" name="reorder" class="lessons">
      <li
        v-for="(l, i) in list"
        :key="l.id"
        class="panel lesson"
        :class="{ dragging: dragId === l.id }"
        :draggable="armed === l.id"
        @dragstart="onDragStart($event, l)"
        @dragenter.prevent="onDragEnter(i)"
        @dragover.prevent
        @drop.prevent
        @dragend="onDragEnd"
      >
        <button
          type="button"
          class="grip"
          :data-grip="l.id"
          :aria-label="`Reorder ${l.title}. Drag, or use the up and down arrow keys.`"
          title="Drag to reorder"
          @mousedown="armed = l.id"
          @mouseup="armed = null"
          @keydown.up.prevent="nudge(i, -1)"
          @keydown.down.prevent="nudge(i, 1)"
        >
          <v-icon icon="mdi-drag-vertical" size="22" />
        </button>
        <span class="touch-order">
          <button type="button" class="arrow" :disabled="i === 0" :aria-label="`Move ${l.title} up`" @click="nudge(i, -1)">▲</button>
          <button type="button" class="arrow" :disabled="i === list.length - 1" :aria-label="`Move ${l.title} down`" @click="nudge(i, 1)">▼</button>
        </span>
        <span class="num">{{ i + 1 }}</span>
        <div class="info">
          <div class="font-weight-bold text-truncate">{{ l.title }}</div>
          <div class="text-caption text-muted d-flex flex-wrap ga-2 align-center">
            <template v-if="l.bunnyVideoId">
              <span v-if="l.sourceHeight">Source {{ h(l.sourceHeight) }}</span>
              <span v-for="r in l.renditions" :key="r.height" class="tag">{{ h(r.height) }}{{ r.ready ? '' : ' …' }}</span>
            </template>
            <span v-else>No video yet</span>
            <span v-if="l.attachmentUrls.length">· {{ l.attachmentUrls.length }} {{ l.attachmentUrls.length === 1 ? 'attachment' : 'attachments' }}</span>
          </div>
        </div>
        <StatusPill v-if="l.bunnyVideoId" :label="vLabel(l.videoStatus)" :tone="tone(l.videoStatus)" />
        <span class="time mono">{{ l.bunnyVideoId && l.durationSec ? duration(l.durationSec) : '--:--' }}</span>
        <span class="acts">
          <VideoUpload :init="() => api.uploadInit(l.id)" :label="l.bunnyVideoId ? 'Replace video' : 'Upload video'" @uploaded="checkStatus(l)" />
          <button v-if="l.bunnyVideoId && l.videoStatus === 'PROCESSING'" type="button" class="row-link" @click="checkStatus(l)">Check status</button>
          <button type="button" class="row-link" @click="openEdit(l)">Edit</button>
          <button type="button" class="row-link danger" @click="del = l">Remove</button>
        </span>
      </li>
    </TransitionGroup>
  </section>

  <v-dialog :model-value="!!edit" max-width="560" @update:model-value="edit = null">
    <v-card v-if="edit" color="surface" class="pa-2">
      <v-card-title>{{ edit.id ? 'Edit lesson' : 'New lesson' }}</v-card-title>
      <v-card-text>
        <v-text-field v-model="edit.title" label="Title" maxlength="150" class="mb-2" />
        <v-textarea v-model="edit.description" label="Description (optional)" rows="3" auto-grow class="mb-2" />
        <v-textarea v-model="edit.attachments" label="Attachment links, one per line (optional)" rows="2" auto-grow />
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn variant="text" @click="edit = null">Cancel</v-btn><v-btn color="primary" variant="flat" :loading="busy" @click="save">Save</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
  <ConfirmDialog :model-value="!!del" title="Delete this lesson?" danger confirm-label="Delete" :loading="busy" @update:model-value="del = null" @confirm="remove">
    "{{ del?.title }}" and its learner progress will be removed. The video is deleted from the host.
  </ConfirmDialog>
</template>

<style scoped>
.lessons {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lesson {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
}
/* Drag handle: a 44px target. */
.grip {
  flex: none;
  width: var(--ot-control-h);
  height: var(--ot-control-h);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--ot-radius-control);
  background: none;
  cursor: grab;
  color: var(--ot-muted);
  transition: background var(--ot-transition), color var(--ot-transition);
}
.grip:hover,
.grip:focus-visible {
  background: var(--ot-accent-hover);
  color: var(--ot-accent-strong);
}
.grip:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: 1px;
}
.grip:active {
  cursor: grabbing;
}
/* Touch screens: up / down buttons instead of the grip. Each a 44px target, side by side. */
.touch-order,
.hint-touch {
  display: none;
  flex: none;
}
.arrow {
  width: var(--ot-control-h);
  height: var(--ot-control-h);
  border: 0;
  border-radius: var(--ot-radius-control);
  background: none;
  cursor: pointer;
  font-size: 11px;
  color: var(--ot-muted);
}
.arrow:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
@media (pointer: coarse) {
  .grip,
  .hint-mouse {
    display: none;
  }
  .touch-order {
    display: flex;
  }
  .hint-touch {
    display: inline;
  }
}
.lesson.dragging {
  opacity: 0.55;
  border-style: dashed;
  border-color: var(--ot-accent);
}
.reorder-move {
  transition: transform 160ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .reorder-move {
    transition: none;
  }
}
.num {
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: var(--ot-radius-control);
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}
.info {
  flex: 1 1 220px;
  min-width: 0;
}
.time {
  font-size: 13px;
  color: var(--ot-muted);
}
.acts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
</style>
