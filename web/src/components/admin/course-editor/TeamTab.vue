<script setup lang="ts">
// Course team (2026-11-27, instructor-made courses): the owner invites up to one more approved instructor by email.
// Co-instructors edit lessons and the final test, grade and answer questions. The course's revenue share goes to
// the owner only (the percent an admin set for the owner); the owner shares it with the team themselves.
import { onMounted, ref } from 'vue';
import * as api from '@/api/instructors';
import type { AdminCourse } from '@/api/admin/courses';
import { errorMessage } from '@/api/client';

const props = defineProps<{ course: AdminCourse; owner: boolean }>();
const rows = ref<api.TeamMember[]>([]);
const email = ref('');
const busy = ref(false);
const err = ref('');
const MAX = 2;
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

onMounted(async () => {
  try {
    rows.value = await api.team(props.course.id);
  } catch (e) {
    err.value = errorMessage(e);
  }
});

async function add() {
  if (!email.value.trim()) return;
  err.value = '';
  busy.value = true;
  try {
    rows.value = await api.addToTeam(props.course.id, email.value.trim());
    email.value = '';
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function remove(id: string) {
  err.value = '';
  try {
    rows.value = await api.removeFromTeam(props.course.id, id);
  } catch (e) {
    err.value = errorMessage(e);
  }
}
</script>

<template>
  <section class="panel pa-6 d-flex flex-column ga-4" style="max-width: 820px" aria-labelledby="team-h">
    <div>
      <h2 id="team-h" class="h3">Team</h2>
      <p class="ma-0 mt-1 text-body-2 text-muted">
        Up to {{ MAX }} instructors per course. A co-instructor can edit lessons and the final test, grade and answer learners' questions.
      </p>
    </div>
    <div class="callout">
      <v-icon icon="mdi-cash-multiple" size="20" />
      <span>The revenue share of this course goes to the course owner. If you teach with someone, share it between you.</span>
    </div>
    <div v-if="err" class="callout danger" role="alert"><span>{{ err }}</span></div>
    <ul class="people">
      <li v-for="r in rows" :key="r.id">
        <span class="avatar" aria-hidden="true">{{ initials(r.name) }}</span>
        <span class="flex-grow-1" style="min-width: 0">
          <span class="d-block font-weight-bold">{{ r.name }}</span>
          <span class="d-block text-caption text-muted text-truncate">{{ r.email }}</span>
        </span>
        <span class="text-caption text-muted">{{ r.owner ? 'Owner' : 'Co-instructor' }}</span>
        <button v-if="owner && !r.owner" type="button" class="row-link danger" @click="remove(r.id)">Remove</button>
      </li>
    </ul>
    <form v-if="owner && rows.length < MAX" class="d-flex flex-wrap ga-2 align-center" @submit.prevent="add">
      <label for="team-email" class="sr-only">Email of an approved instructor</label>
      <input id="team-email" v-model="email" type="email" class="ot-input" style="flex: 1 1 280px" placeholder="Email of an approved instructor" autocomplete="off" />
      <v-btn type="submit" color="primary" :loading="busy" :disabled="!email.trim()">Add co-instructor</v-btn>
    </form>
    <span v-if="!owner" class="text-caption text-muted">Only the course owner can change the team.</span>
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
  flex-wrap: wrap;
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
  border-radius: var(--ot-radius-control);
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}
</style>
