<script setup lang="ts">
// Final test of an assigned course (2026-11-22): settings (pass %, time limit, attempts) and questions.
// Same editor as the admin course editor, calling /instructor/*; the server checks the assignment (NOT_ASSIGNED).
// Instructors cannot edit course details or lessons.
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import FinalTestTab from '@/components/admin/course-editor/FinalTestTab.vue';
import * as insApi from '@/api/instructor';
import { quizApi, type QuizView } from '@/api/admin/quiz';
import { errorMessage } from '@/api/client';

const route = useRoute();
const api = quizApi('/instructor');
const id = computed(() => String(route.params.id));
const courses = ref<insApi.InstructorCourse[]>([]);
const quiz = ref<QuizView>(null);
const loaded = ref(false);
const err = ref('');
const course = computed(() => courses.value.find((c) => c.id === id.value));

async function load() {
  err.value = '';
  try {
    quiz.value = await api.getQuiz(id.value);
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    loaded.value = true;
  }
}
onMounted(async () => {
  courses.value = await insApi.courses().catch(() => []);
  await load();
});
watch(id, () => {
  loaded.value = false;
  void load();
});
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader :title="course ? `Final test · ${course.title}` : 'Final test'" subtitle="Set the pass mark, time limit and attempts, and manage the questions. Course details and lessons are edited by an admin.">
      <v-btn variant="outlined" to="/instructor" prepend-icon="mdi-arrow-left">My courses</v-btn>
    </AdminPageHeader>
    <v-skeleton-loader v-if="!loaded" type="article" color="surface" />
    <EmptyState v-else-if="err" class="panel" icon="mdi-lock-outline" title="You cannot edit this test" :text="err" />
    <FinalTestTab v-else :course="{ id, quiz }" base="/instructor" @changed="load" />
  </div>
</template>
