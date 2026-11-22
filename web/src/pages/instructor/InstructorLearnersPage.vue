<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import LearnersTable from '@/components/staff/LearnersTable.vue';
import * as insApi from '@/api/instructor';
import type { LearnerRow } from '@/api/admin/grading';

const route = useRoute();
const id = String(route.params.id);
const rows = ref<LearnerRow[] | null>(null);
const courses = ref<insApi.InstructorCourse[]>([]);
const course = computed(() => courses.value.find((c) => c.id === id));
const failed = ref(false);
onMounted(async () => {
  try {
    [rows.value, courses.value] = await Promise.all([insApi.learners(id), insApi.courses()]);
  } catch {
    failed.value = true;
  }
});
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader :title="course ? `Learners · ${course.title}` : 'Learners'" subtitle="Progress, test results and round for each learner." back="/instructor" />
    <div v-if="failed" class="callout danger" role="alert">You are not assigned to this course.</div>
    <v-skeleton-loader v-else-if="!rows" type="table" color="surface" />
    <LearnersTable v-else :rows="rows" grading-base="/instructor/grading" />
  </div>
</template>
