<script setup lang="ts">
// Instructor "My courses" (mockup Instructor): stat tiles + table of my courses (made by me or co-taught) with shortcuts.
// 2026-11-27: instructors create their own courses; an admin reviews each one before it is published.
import { onMounted, ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import * as insApi from '@/api/instructor';
import CourseCover from '@/components/course/CourseCover.vue';

const d = ref<Awaited<ReturnType<typeof insApi.dashboard>> | null>(null);
onMounted(async () => (d.value = await insApi.dashboard()));
const tone = (s: string) => (s === 'PUBLISHED' ? 'success' : s === 'DRAFT' || s === 'IN_REVIEW' ? 'warning' : 'neutral');
const LABEL: Record<string, string> = { DRAFT: 'Draft', IN_REVIEW: 'In review', PUBLISHED: 'Published', ARCHIVED: 'Archived' };
const label = (s: string) => LABEL[s] ?? s;
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="My courses" subtitle="Make your courses, send them for review, see your learners, grade written answers and reply to questions.">
      <v-btn color="primary" prepend-icon="mdi-plus" to="/instructor/courses/new">New course</v-btn>
    </AdminPageHeader>
    <v-skeleton-loader v-if="!d" type="card" color="surface" />
    <template v-else>
      <div class="tiles">
        <div class="stat panel">
          <span class="stat-label">Courses</span>
          <span class="stat-value">{{ d.courses.length }}</span>
        </div>
        <div class="stat panel">
          <span class="stat-label">Learners</span>
          <span class="stat-value">{{ d.learners }}</span>
        </div>
        <router-link to="/instructor/grading" class="stat panel">
          <span class="stat-label">Waiting for grading</span>
          <span class="stat-value" :style="d.gradingWaiting ? 'color: var(--ot-warning)' : ''">{{ d.gradingWaiting }}</span>
          <span class="stat-note">{{ d.gradingWaiting ? 'Written answers to check' : 'All caught up' }}</span>
        </router-link>
        <router-link to="/instructor/messages" class="stat panel">
          <span class="stat-label">Unread conversations</span>
          <span class="stat-value">{{ d.unreadThreads }}</span>
        </router-link>
      </div>

      <div v-if="!d.courses.length" class="panel pa-10 text-center">
        <v-icon icon="mdi-book-outline" size="32" color="primary" class="mb-2" />
        <div class="font-weight-bold">No courses yet</div>
        <div class="text-body-2 text-muted mb-4">Make your first course. It stays a draft until you send it for review.</div>
        <v-btn color="primary" to="/instructor/courses/new">New course</v-btn>
      </div>
      <div v-else class="table-scroll">
        <table class="data-table" style="min-width: 760px">
          <caption class="sr-only">My courses</caption>
          <thead>
            <tr>
              <th scope="col">Course</th>
              <th scope="col">Status</th>
              <th scope="col">Lessons</th>
              <th scope="col">Learners</th>
              <th scope="col" class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in d.courses" :key="c.id">
              <td>
                <div class="d-flex align-center ga-4">
                  <span class="cthumb"><CourseCover :image-url="c.thumbnailUrl" :title="c.title" size="sm" /></span>
                  <span class="d-flex flex-column" style="min-width: 0">
                    <router-link :to="`/instructor/courses/${c.id}`" class="font-weight-bold title-link">{{ c.title }}</router-link>
                    <span class="text-caption text-muted">{{ c.isOwner ? 'Your course' : `Co-instructor · owner ${c.owner?.name ?? 'admin'}` }}</span>
                    <span v-if="c.status === 'DRAFT' && c.reviewNote" class="text-caption text-warning">Sent back: {{ c.reviewNote }}</span>
                  </span>
                </div>
              </td>
              <td><StatusPill :label="label(c.status)" :tone="tone(c.status)" /></td>
              <td>{{ c.lessons }}</td>
              <td>{{ c.learners }}</td>
              <td class="text-right text-no-wrap">
                <router-link :to="`/instructor/courses/${c.id}`" class="row-btn">Edit</router-link>
                <router-link :to="`/instructor/courses/${c.id}/learners`" class="row-link">Learners</router-link>
                <router-link :to="`/instructor/courses/${c.id}/preview`" class="row-link">Preview</router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
.title-link {
  color: inherit;
  text-decoration: none;
}
.title-link:hover {
  text-decoration: underline;
}
.cthumb {
  width: 64px;
  height: 40px;
  flex: none;
  border-radius: var(--ot-radius-pill);
  background: var(--ot-thumb);
  overflow: hidden;
}
.cthumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
