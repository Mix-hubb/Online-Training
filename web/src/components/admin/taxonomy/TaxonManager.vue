<script setup lang="ts">
// Generic list editor for categories or tags.
import { ref } from 'vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import type { TaxonRow } from '@/api/admin/taxonomy';
import { errorMessage } from '@/api/client';

const props = defineProps<{
  title: string;
  rows: TaxonRow[];
  add: (n: string) => Promise<unknown>;
  rename: (id: string, n: string) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}>();
const emit = defineEmits<{ changed: [] }>();
const name = ref('');
const singular = props.title.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '');
const editing = ref<{ id: string; name: string } | null>(null);
const del = ref<TaxonRow | null>(null);
const err = ref('');
async function run(fn: () => Promise<unknown>) {
  err.value = '';
  try {
    await fn();
    emit('changed');
  } catch (e) {
    err.value = errorMessage(e);
  }
}
async function addOne() {
  if (!name.value.trim()) return;
  await run(() => props.add(name.value.trim()));
  name.value = '';
}
async function saveEdit() {
  if (!editing.value) return;
  const e = editing.value;
  editing.value = null;
  await run(() => props.rename(e.id, e.name.trim()));
}
async function removeOne() {
  const d = del.value!;
  del.value = null;
  await run(() => props.remove(d.id));
}
</script>

<template>
  <section class="panel" :aria-label="title">
    <div class="panel-head"><h2 class="h2">{{ title }}</h2><span class="text-body-2 text-muted">{{ rows.length }}</span></div>
    <div class="pa-5 d-flex flex-column ga-4">
      <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
      <form class="d-flex ga-2" @submit.prevent="addOne">
        <label :for="`add-${title}`" class="sr-only">New {{ singular }}</label>
        <input :id="`add-${title}`" v-model="name" class="ot-input" :placeholder="`New ${singular}`" maxlength="80" />
        <v-btn type="submit" color="primary" min-height="44">Add</v-btn>
      </form>
    </div>
    <ul class="rows">
      <li v-for="r in rows" :key="r.id">
        <input v-if="editing?.id === r.id" v-model="editing.name" class="ot-input flex-grow-1" :aria-label="`Rename ${r.name}`" autofocus @keydown.enter="saveEdit" @blur="saveEdit" />
        <div v-else class="flex-grow-1" style="min-width: 0">
          <div class="font-weight-medium">{{ r.name }}</div>
          <div class="text-caption text-muted">{{ r._count.courses }} {{ r._count.courses === 1 ? 'course' : 'courses' }}</div>
        </div>
        <button type="button" class="row-link" @click="editing = { id: r.id, name: r.name }">Rename</button>
        <button type="button" class="row-link danger" @click="del = r">Delete</button>
      </li>
      <li v-if="!rows.length" class="text-body-2 text-muted">None yet.</li>
    </ul>
    <ConfirmDialog :model-value="!!del" :title="`Delete “${del?.name}”?`" danger confirm-label="Delete" @update:model-value="del = null" @confirm="removeOne">
      Courses using it keep working; they just lose this label.
    </ConfirmDialog>
  </section>
</template>

<style scoped>
.h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--ot-border);
}
.rows li {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px 10px 20px;
  border-bottom: 1px solid var(--ot-border);
  font-size: 14px;
}
.rows li:last-child {
  border-bottom: 0;
}
</style>
