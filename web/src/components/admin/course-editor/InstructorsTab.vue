<script setup lang="ts">
// Assign up to 2 instructors (users with role INSTRUCTOR) and set each one's share of THIS course's sales.
// Instructor shares are paid first; co-investors (Partners page) get their percent of what is left.
// A new percent applies only to orders paid after the change.
import { computed, onMounted, ref } from 'vue';
import * as ins from '@/api/admin/instructors';
import * as users from '@/api/admin/users';
import type { AdminCourse } from '@/api/admin/courses';
import { errorMessage } from '@/api/client';
import { percentBp } from '@/utils/format';

const props = defineProps<{ course: AdminCourse }>();
const rows = ref<ins.CourseInstructorRow[]>([]);
const pool = ref<users.UserRow[]>([]);
const pick = ref<string | null>(null);
const pickShare = ref('0');
const drafts = ref<Record<string, string>>({});
const saving = ref<string | null>(null);
const saved = ref<string | null>(null);
const err = ref('');
const free = computed(() => pool.value.filter((u) => !rows.value.some((r) => r.userId === u.id)));
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

/** "12.5" -> 1250 bp; NaN when not a number from 0 to 100 with at most 2 decimals. */
function toBp(v: string) {
  const n = Number(String(v).trim());
  if (!/^\d+(\.\d{1,2})?$/.test(String(v).trim()) || n < 0 || n > 100) return NaN;
  return Math.round(n * 100);
}
const totalBp = computed(() => rows.value.reduce((s, r) => s + r.sharePercentBp, 0));

function setRows(list: ins.CourseInstructorRow[]) {
  rows.value = list;
  drafts.value = Object.fromEntries(list.map((r) => [r.userId, String(r.sharePercentBp / 100)]));
}
async function load() {
  const [list, page] = await Promise.all([ins.list(props.course.id), users.list({ role: 'INSTRUCTOR' })]);
  setRows(list);
  pool.value = page.items;
}
onMounted(load);

async function add() {
  if (!pick.value) return;
  err.value = '';
  const bp = toBp(pickShare.value);
  if (Number.isNaN(bp)) return void (err.value = 'Enter a share from 0 to 100%.');
  try {
    setRows(await ins.assign(props.course.id, pick.value, bp));
    pick.value = null;
    pickShare.value = '0';
  } catch (e) {
    err.value = errorMessage(e);
  }
}
async function saveShare(r: ins.CourseInstructorRow) {
  err.value = '';
  saved.value = null;
  const bp = toBp(drafts.value[r.userId] ?? '');
  if (Number.isNaN(bp)) return void (err.value = 'Enter a share from 0 to 100%.');
  saving.value = r.userId;
  try {
    setRows(await ins.setShare(props.course.id, r.userId, bp));
    saved.value = r.userId;
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    saving.value = null;
  }
}
async function remove(id: string) {
  setRows(await ins.unassign(props.course.id, id));
}
</script>

<template>
  <section class="panel pa-6 d-flex flex-column ga-4" style="max-width: 820px" aria-labelledby="ins-h">
    <div>
      <h2 id="ins-h" class="h3">Instructors</h2>
      <p class="ma-0 mt-1 text-body-2 text-muted">Up to 2 per course. They can see learners, grade and answer questions. They cannot edit content. To make someone an instructor, open Users.</p>
    </div>

    <div class="callout">
      <v-icon icon="mdi-cash-multiple" size="20" />
      <span>
        Each instructor gets their share of <strong>this course's</strong> sales, paid before co-investors. Co-investors get their percent of what is left.
        Instructors on this course: <strong>{{ percentBp(totalBp) }}</strong>. A new share applies only to orders paid after the change.
      </span>
    </div>

    <div v-if="err" class="callout danger" role="alert"><span>{{ err }}</span></div>
    <ul class="people">
      <li v-for="r in rows" :key="r.userId">
        <span class="avatar" aria-hidden="true">{{ initials(r.user.name) }}</span>
        <span class="flex-grow-1" style="min-width: 0">
          <span class="d-block font-weight-bold">{{ r.user.name }}</span>
          <span class="d-block text-caption text-muted text-truncate">{{ r.user.email }}</span>
        </span>
        <form class="share" @submit.prevent="saveShare(r)">
          <label :for="`share-${r.userId}`" class="text-caption text-muted">Share</label>
          <span class="pct">
            <input :id="`share-${r.userId}`" v-model="drafts[r.userId]" class="ot-input" inputmode="decimal" :aria-label="`Share of ${r.user.name}, percent`" />
            <span aria-hidden="true">%</span>
          </span>
          <v-btn
            type="submit"
            size="small"
            variant="outlined"
            :loading="saving === r.userId"
            :disabled="drafts[r.userId] === String(r.sharePercentBp / 100)"
          >Save</v-btn>
          <span v-if="saved === r.userId" class="text-caption text-success" role="status">Saved</span>
        </form>
        <button type="button" class="row-link danger" @click="remove(r.userId)">Remove</button>
      </li>
      <li v-if="!rows.length" class="text-body-2 text-muted">No instructors assigned.</li>
    </ul>

    <form v-if="rows.length < 2" class="d-flex flex-wrap ga-2 align-center" @submit.prevent="add">
      <label for="ins-pick" class="sr-only">Instructor to assign</label>
      <select id="ins-pick" v-model="pick" class="ot-select" style="flex: 1 1 280px">
        <option :value="null">Choose an instructor…</option>
        <option v-for="u in free" :key="u.id" :value="u.id">{{ u.name }} ({{ u.email }})</option>
      </select>
      <span class="pct">
        <input id="ins-share" v-model="pickShare" class="ot-input" inputmode="decimal" aria-label="Share of this course for the new instructor, percent" />
        <span aria-hidden="true">%</span>
      </span>
      <v-btn type="submit" color="primary" :disabled="!pick">Assign instructor</v-btn>
    </form>
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
.share {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pct {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.pct .ot-input {
  width: 72px;
  text-align: right;
}
</style>
