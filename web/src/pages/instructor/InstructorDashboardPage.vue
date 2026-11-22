<script setup lang="ts">
// Instructor "My courses" (mockup Instructor): stat tiles + table of assigned courses with shortcuts.
import { onMounted, ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import * as insApi from '@/api/instructor';

const d = ref<Awaited<ReturnType<typeof insApi.dashboard>> | null>(null);
onMounted(async () => (d.value = await insApi.dashboard()));
const tone = (s: string) => (s === 'PUBLISHED' ? 'success' : s === 'DRAFT' ? 'warning' : 'neutral');
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="My courses" subtitle="Courses an admin assigned to you. See your learners, grade written answers and reply to questions." />
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
        <div class="font-weight-bold">No courses assigned yet</div>
        <div class="text-body-2 text-muted">An admin assigns you to courses.</div>
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
                  <span class="cthumb"><img v-if="c.thumbnailUrl" :src="c.thumbnailUrl" alt="" /></span>
                  <span class="font-weight-bold">{{ c.title }}</span>
                </div>
              </td>
              <td><StatusPill :label="label(c.status)" :tone="tone(c.status)" /></td>
              <td>{{ c.lessons }}</td>
              <td>{{ c.learners }}</td>
              <td class="text-right text-no-wrap">
                <router-link :to="`/instructor/courses/${c.id}/learners`" class="row-btn">Learners</router-link>
                <router-link :to="`/instructor/courses/${c.id}/quiz`" class="row-link">Final test</router-link>
                <router-link :to="`/learn/${c.slug}`" class="row-link">Preview</router-link>
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
.cthumb {
  width: 64px;
  height: 40px;
  flex: none;
  border-radius: 3px;
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
