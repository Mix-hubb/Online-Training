<script setup lang="ts">
// Course editor: Details, Lessons, Final test, Instructors, Revenue sharing, Learners. Status + delete.
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import DetailsTab from '@/components/admin/course-editor/DetailsTab.vue';
import LessonsTab from '@/components/admin/course-editor/LessonsTab.vue';
import FinalTestTab from '@/components/admin/course-editor/FinalTestTab.vue';
import InstructorsTab from '@/components/admin/course-editor/InstructorsTab.vue';
import LearnersTable from '@/components/staff/LearnersTable.vue';
import * as api from '@/api/admin/courses';
import * as grading from '@/api/admin/grading';
import { errorMessage } from '@/api/client';
import type { CourseStatus } from '@/types';

const route = useRoute();
const router = useRouter();
const course = ref<api.AdminCourse | null>(null);
const tab = ref(String(route.query.tab ?? 'details'));
const learners = ref<grading.LearnerRow[] | null>(null);
const confirmDelete = ref(false);
const err = ref('');
const isNew = computed(() => !route.params.id);

async function load() {
  if (route.params.id) course.value = await api.getOne(String(route.params.id));
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
  if (isNew.value) await router.replace(`/admin/courses/${c.id}`);
  course.value = await api.getOne(c.id);
}
async function setStatus(s: CourseStatus) {
  err.value = '';
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
    await router.replace('/admin/courses');
  } catch (e) {
    confirmDelete.value = false;
    err.value = errorMessage(e);
  }
}
const statusLabel: Record<string, string> = { DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' };
const tabs = computed(() => [
  { v: 'details', label: 'Details' },
  { v: 'lessons', label: 'Lessons (' + (course.value?.lessons.length ?? 0) + ')' },
  { v: 'test', label: 'Final test' },
  { v: 'instructors', label: 'Instructors' },
  { v: 'learners', label: 'Learners (' + (course.value?._count.enrollments ?? 0) + ')' },
]);
const tone = (s: string) => (s === 'PUBLISHED' ? 'success' : s === 'DRAFT' ? 'warning' : 'neutral');
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <div class="ed-head">
      <div class="d-flex flex-column ga-2" style="min-width: 0">
        <router-link to="/admin/courses" class="back">← All courses</router-link>
        <div class="d-flex flex-wrap align-center ga-3">
          <h1 class="ed-title">{{ isNew ? 'New course' : course?.title ?? 'Course' }}</h1>
          <StatusPill v-if="course" :label="statusLabel[course.status]" :tone="tone(course.status)" />
        </div>
      </div>
      <div v-if="course" class="d-flex flex-wrap align-center ga-2">
        <v-btn variant="outlined" :to="`/admin/courses/${course.id}/preview`">Preview as user</v-btn>
        <v-btn v-if="course.status === 'PUBLISHED'" variant="outlined" @click="setStatus('DRAFT')">Unpublish</v-btn>
        <v-btn v-if="course.status !== 'ARCHIVED'" variant="outlined" @click="setStatus('ARCHIVED')">Archive</v-btn>
        <v-btn v-if="course.status !== 'PUBLISHED'" color="primary" @click="setStatus('PUBLISHED')">Publish</v-btn>
        <v-btn variant="text" color="error" @click="confirmDelete = true">Delete</v-btn>
      </div>
    </div>
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <DetailsTab v-if="isNew" :course="null" @saved="onSaved" />
    <v-skeleton-loader v-else-if="!course" type="article" color="surface" />
    <template v-else>
      <div role="tablist" aria-label="Course sections" class="ul-tabs">
        <button v-for="t in tabs" :key="t.v" type="button" role="tab" :aria-selected="tab === t.v" @click="tab = t.v">{{ t.label }}</button>
      </div>
      <DetailsTab v-if="tab === 'details'" :course="course" @saved="onSaved" />
      <LessonsTab v-else-if="tab === 'lessons'" :course="course" @changed="load" />
      <FinalTestTab v-else-if="tab === 'test'" :course="course" @changed="load" />
      <InstructorsTab v-else-if="tab === 'instructors'" :course="course" />
      <template v-else-if="tab === 'learners'">
        <v-skeleton-loader v-if="!learners" type="table" color="surface" />
        <LearnersTable v-else :rows="learners" grading-base="/admin/grading" />
      </template>
    </template>
    <ConfirmDialog v-model="confirmDelete" title="Delete this course?" danger confirm-label="Delete" @confirm="remove">
      Courses with learners or orders cannot be deleted; archive them instead.
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
  font-size: 13px;
  color: var(--ot-muted);
  text-decoration: none;
}
.ed-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
</style>
