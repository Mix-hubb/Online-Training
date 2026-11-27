<script setup lang="ts">
// Course editor: Details, Lessons, Final test, Team / Instructors, Learners. Status + delete.
// 2026-11-27: instructors make and run their own courses here (/instructor/courses/...). A new course starts as a
// draft; the owner sends it for review and an admin approves it. Admins edit only older courses without an owner
// (instructor courses open read-only in the preview, where admins approve or send them back).
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import DetailsTab from '@/components/admin/course-editor/DetailsTab.vue';
import LessonsTab from '@/components/admin/course-editor/LessonsTab.vue';
import FinalTestTab from '@/components/admin/course-editor/FinalTestTab.vue';
import InstructorsTab from '@/components/admin/course-editor/InstructorsTab.vue';
import TeamTab from '@/components/admin/course-editor/TeamTab.vue';
import LearnersTable from '@/components/staff/LearnersTable.vue';
import * as api from '@/api/admin/courses';
import * as grading from '@/api/admin/grading';
import { scope } from '@/api/admin/scope';
import { errorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import type { CourseStatus } from '@/types';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const base = scope();
const asInstructor = base === '/instructor';
const course = ref<api.AdminCourse | null>(null);
const tab = ref(String(route.query.tab ?? 'details'));
const learners = ref<grading.LearnerRow[] | null>(null);
const confirmDelete = ref(false);
const confirmSubmit = ref(false);
const err = ref('');
const isNew = computed(() => !route.params.id);
const listPath = asInstructor ? '/instructor' : '/admin/courses';
/** I made this course (or it is an older admin-run course and I am an admin). */
const isOwner = computed(() => (course.value ? (asInstructor ? course.value.ownerId === auth.user?.id : !course.value.ownerId) : true));

async function load() {
  if (!route.params.id) return;
  const c = await api.getOne(String(route.params.id));
  // Admins review instructor courses in the preview; they do not edit them.
  if (!asInstructor && c.ownerId) {
    await router.replace(`/admin/courses/${c.id}/preview`);
    return;
  }
  course.value = c;
}
onMounted(load);
watch(tab, (t) => void router.replace({ query: { tab: t } }));
watch(
  () => route.query.tab,
  (t) => {
    if (typeof t === 'string' && t !== tab.value) tab.value = t;
  },
);
watch(
  [tab, () => course.value?.id],
  async ([t, id]) => {
    if (t === 'learners' && id) learners.value = await grading.learners(id);
  },
  { immediate: true },
);
async function onSaved(c: api.AdminCourse) {
  // New course: stay in the editor (next step is adding lessons). Existing course: back to the list.
  if (isNew.value) {
    await router.replace(`${base}/courses/${c.id}`);
    course.value = await api.getOne(c.id);
    return;
  }
  await router.push({ path: listPath, state: { savedCourse: c.title } });
}
async function setStatus(s: CourseStatus) {
  err.value = '';
  confirmSubmit.value = false;
  try {
    await api.setStatus(course.value!.id, s);
    await load();
  } catch (e) {
    err.value = errorMessage(e);
  }
}
async function remove() {
  try {
    await api.remove(course.value!.id);
    await router.replace(listPath);
  } catch (e) {
    confirmDelete.value = false;
    err.value = errorMessage(e);
  }
}
const statusLabel: Record<string, string> = { DRAFT: 'Draft', IN_REVIEW: 'In review', PUBLISHED: 'Published', ARCHIVED: 'Archived' };
const tabs = computed(() => [
  { v: 'details', label: 'Details' },
  { v: 'lessons', label: 'Lessons (' + (course.value?.lessons.length ?? 0) + ')' },
  { v: 'test', label: 'Final test' },
  asInstructor ? { v: 'team', label: 'Team' } : { v: 'instructors', label: 'Instructors' },
  { v: 'learners', label: 'Learners (' + (course.value?._count.enrollments ?? 0) + ')' },
]);
const tone = (s: string) => (s === 'PUBLISHED' ? 'success' : s === 'DRAFT' || s === 'IN_REVIEW' ? 'warning' : 'neutral');
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <div class="ed-head">
      <div class="d-flex flex-column ga-2" style="min-width: 0">
        <router-link :to="listPath" class="back">{{ asInstructor ? '← My courses' : '← All courses' }}</router-link>
        <div class="d-flex flex-wrap align-center ga-3">
          <h1 class="ed-title">{{ isNew ? 'New course' : course?.title ?? 'Course' }}</h1>
          <StatusPill v-if="course" :label="statusLabel[course.status]" :tone="tone(course.status)" />
        </div>
      </div>
      <div v-if="course" class="d-flex flex-wrap align-center ga-2">
        <v-btn variant="outlined" :to="`${base}/courses/${course.id}/preview`">Preview as user</v-btn>
        <template v-if="asInstructor && isOwner">
          <v-btn v-if="course.status === 'IN_REVIEW'" variant="outlined" @click="setStatus('DRAFT')">Withdraw from review</v-btn>
          <v-btn v-if="course.status === 'PUBLISHED'" variant="outlined" @click="setStatus('DRAFT')">Unpublish</v-btn>
          <v-btn v-if="course.status === 'PUBLISHED'" variant="outlined" @click="setStatus('ARCHIVED')">Archive</v-btn>
          <v-btn v-if="course.status === 'ARCHIVED'" variant="outlined" @click="setStatus('DRAFT')">Back to draft</v-btn>
          <v-btn v-if="course.status === 'DRAFT'" color="primary" @click="confirmSubmit = true">Send for review</v-btn>
          <v-btn variant="text" color="error" @click="confirmDelete = true">Delete</v-btn>
        </template>
        <template v-else-if="!asInstructor">
          <v-btn v-if="course.status === 'PUBLISHED'" variant="outlined" @click="setStatus('DRAFT')">Unpublish</v-btn>
          <v-btn v-if="course.status !== 'ARCHIVED'" variant="outlined" @click="setStatus('ARCHIVED')">Archive</v-btn>
          <v-btn v-if="course.status !== 'PUBLISHED'" color="primary" @click="setStatus('PUBLISHED')">Publish</v-btn>
          <v-btn variant="text" color="error" @click="confirmDelete = true">Delete</v-btn>
        </template>
      </div>
    </div>
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <template v-if="course && asInstructor">
      <div v-if="course.status === 'DRAFT' && course.reviewNote" class="callout warning" role="status">
        <strong>Sent back by an admin:</strong> {{ course.reviewNote }} Make the changes, then send the course for review again.
      </div>
      <div v-else-if="course.status === 'IN_REVIEW'" class="callout" role="status">
        Waiting for an admin to review this course. You can still edit it; learners see it once it is approved.
      </div>
      <div v-else-if="course.status === 'DRAFT'" class="callout" role="status">
        Draft: only you and your co-instructors can see it. Add lessons, then send it for review.
      </div>
      <div v-if="!isOwner" class="callout" role="status">
        You are a co-instructor: you can edit lessons and the final test. {{ course.owner?.name ?? 'The owner' }} manages details, price and the team.
      </div>
    </template>
    <DetailsTab v-if="isNew" :course="null" @saved="onSaved" />
    <v-skeleton-loader v-else-if="!course" type="article" color="surface" />
    <template v-else>
      <div role="tablist" aria-label="Course sections" class="ul-tabs">
        <button v-for="t in tabs" :key="t.v" type="button" role="tab" :aria-selected="tab === t.v" @click="tab = t.v">{{ t.label }}</button>
      </div>
      <fieldset v-if="tab === 'details'" class="plain" :disabled="!isOwner">
        <DetailsTab :course="course" @saved="onSaved" />
      </fieldset>
      <LessonsTab v-else-if="tab === 'lessons'" :course="course" @changed="load" />
      <FinalTestTab v-else-if="tab === 'test'" :course="course" @changed="load" />
      <TeamTab v-else-if="tab === 'team'" :course="course" :owner="isOwner" />
      <InstructorsTab v-else-if="tab === 'instructors'" :course="course" />
      <template v-else-if="tab === 'learners'">
        <v-skeleton-loader v-if="!learners" type="table" color="surface" />
        <LearnersTable v-else :rows="learners" :grading-base="asInstructor ? '/instructor/grading' : '/admin/grading'" />
      </template>
    </template>
    <ConfirmDialog v-model="confirmDelete" title="Delete this course?" danger confirm-label="Delete" @confirm="remove">
      Courses with learners or orders cannot be deleted; archive them instead.
    </ConfirmDialog>
    <ConfirmDialog v-model="confirmSubmit" title="Send this course for review?" confirm-label="Send for review" @confirm="setStatus('IN_REVIEW')">
      An admin checks the course and publishes it. You can keep editing while it waits.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.ed-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: var(--ot-control-h);
  font-size: var(--ot-fs-sm);
  color: var(--ot-muted);
  text-decoration: none;
  transition: color var(--ot-transition);
}
.back:hover {
  color: var(--ot-text);
  text-decoration: underline;
}
.ed-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.plain {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
</style>
