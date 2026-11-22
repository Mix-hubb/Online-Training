<script setup lang="ts">
// Assign up to 2 instructors (users with role INSTRUCTOR).
import { computed, onMounted, ref } from 'vue';
import * as ins from '@/api/admin/instructors';
import * as users from '@/api/admin/users';
import type { AdminCourse } from '@/api/admin/courses';
import { errorMessage } from '@/api/client';

const props = defineProps<{ course: AdminCourse }>();
const rows = ref<ins.CourseInstructorRow[]>([]);
const pool = ref<users.UserRow[]>([]);
const pick = ref<string | null>(null);
const err = ref('');
const free = computed(() => pool.value.filter((u) => !rows.value.some((r) => r.userId === u.id)));
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
async function load() {
  [rows.value, pool.value] = await Promise.all([ins.list(props.course.id), users.list({ role: 'INSTRUCTOR' }).then((p) => p.items)]);
}
onMounted(load);
async function add() {
  if (!pick.value) return;
  err.value = '';
  try {
    rows.value = await ins.assign(props.course.id, pick.value);
    pick.value = null;
  } catch (e) {
    err.value = errorMessage(e);
  }
}
async function remove(id: string) {
  rows.value = await ins.unassign(props.course.id, id);
}
</script>

<template>
  <section class="panel pa-6 d-flex flex-column ga-4" style="max-width: 760px" aria-labelledby="ins-h">
    <div>
      <h2 id="ins-h" class="h3">Instructors</h2>
      <p class="ma-0 mt-1 text-body-2 text-muted">Up to 2 per course. They can see learners, grade and answer questions. They cannot edit content. To make someone an instructor, open Users.</p>
    </div>
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <ul class="people">
      <li v-for="r in rows" :key="r.userId">
        <span class="avatar" aria-hidden="true">{{ initials(r.user.name) }}</span>
        <span class="flex-grow-1" style="min-width: 0">
          <span class="d-block font-weight-bold">{{ r.user.name }}</span>
          <span class="d-block text-caption text-muted text-truncate">{{ r.user.email }}</span>
        </span>
        <button type="button" class="row-link danger" @click="remove(r.userId)">Remove</button>
      </li>
      <li v-if="!rows.length" class="text-body-2 text-muted">No instructors assigned.</li>
    </ul>
    <div v-if="rows.length < 2" class="d-flex flex-wrap ga-2 align-center">
      <label for="ins-pick" class="sr-only">Instructor to assign</label>
      <select id="ins-pick" v-model="pick" class="ot-select" style="flex: 1 1 280px">
        <option :value="null">Choose an instructor…</option>
        <option v-for="u in free" :key="u.id" :value="u.id">{{ u.name }} ({{ u.email }})</option>
      </select>
      <v-btn color="primary" :disabled="!pick" @click="add">Assign instructor</v-btn>
    </div>
    <span v-if="rows.length < 2 && !free.length" class="text-caption text-muted">No other users have the instructor role.</span>
  </section>
</template>

<style scoped>
.h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.people {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.people li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--ot-border);
}
.people li:last-child {
  border-bottom: 1px solid var(--ot-border);
}
.avatar {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 4px;
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}
</style>
