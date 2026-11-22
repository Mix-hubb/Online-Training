<script setup lang="ts">
// Admin preview (mockup AdminPreview): a preview bar over the course page exactly as learners see it.
// Buying and enrolling are switched off here; drafts are served to admins by the catalog API.
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import CoursePage from '@/pages/user/course/CoursePage.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import * as api from '@/api/admin/courses';
import { errorMessage } from '@/api/client';

const route = useRoute();
const id = String(route.params.id);
const course = ref<api.AdminCourse | null>(null);
const err = ref('');
onMounted(async () => {
  try {
    course.value = await api.getOne(id);
  } catch (e) {
    err.value = errorMessage(e);
  }
});
const tone = (s: string) => (s === 'PUBLISHED' ? 'success' : s === 'DRAFT' ? 'warning' : 'neutral');
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
</script>

<template>
  <div>
    <div class="pbar" role="status">
      <span><strong>Preview mode.</strong> You see this course the way a learner sees it. Nothing here is saved or counted, and buying is switched off.</span>
      <span class="d-flex align-center ga-3">
        <StatusPill v-if="course" :label="label(course.status)" :tone="tone(course.status)" />
        <router-link :to="`/admin/courses/${id}`" class="exit">Exit preview</router-link>
      </span>
    </div>
    <div v-if="err" class="page"><div class="callout danger" role="alert">{{ err }}</div></div>
    <v-skeleton-loader v-else-if="!course" type="heading, paragraph, image" color="surface" class="page" />
    <CoursePage v-else :slug="course.slug" preview />
  </div>
</template>

<style scoped>
.pbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 24px;
  background: var(--ot-warning-bg);
  border-bottom: 1px solid var(--ot-warning-border);
  font-size: 14px;
  color: var(--ot-text);
}
.exit {
  height: 36px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
  border: 1px solid var(--ot-input-border);
  background: var(--ot-surface);
  color: var(--ot-text);
  font-weight: 600;
  text-decoration: none;
  box-shadow: var(--ot-shadow-btn);
}
</style>
