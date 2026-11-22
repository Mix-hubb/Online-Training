<script setup lang="ts">
// Learners of one course with progress and test status (admin + instructor).
import { computed, ref } from 'vue';
import StatusPill from '@/components/common/StatusPill.vue';
import type { LearnerRow } from '@/api/admin/grading';
import { date, learningStatusLabel } from '@/utils/format';
import type { LearningStatus } from '@/types';

const props = defineProps<{ rows: LearnerRow[]; gradingBase: string }>();
const q = ref('');
const shown = computed(() => props.rows.filter((r) => !q.value || `${r.learner.name} ${r.learner.email}`.toLowerCase().includes(q.value.toLowerCase())));
const tone = (s: string) => (s === 'COMPLETED' ? 'success' : s === 'WAITING_FOR_INSTRUCTOR' ? 'warning' : 'neutral');
</script>

<template>
  <div class="d-flex flex-column ga-4">
    <div class="filters">
      <div class="grow2"><label for="lq" class="sr-only">Search learners</label><input id="lq" v-model="q" type="search" class="ot-input" placeholder="Search name or email" /></div>
    </div>
    <div v-if="!shown.length" class="panel pa-8 text-center text-body-2 text-muted">No learners.</div>
    <div v-else class="table-scroll">
      <table class="data-table" style="min-width: 860px">
        <caption class="sr-only">Learners</caption>
        <thead>
          <tr>
            <th scope="col">Learner</th>
            <th scope="col">Progress</th>
            <th scope="col">Status</th>
            <th scope="col">Test</th>
            <th scope="col">Round</th>
            <th scope="col">Last activity</th>
            <th scope="col" class="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in shown" :key="r.enrollmentId">
            <td>
              <div class="font-weight-medium">{{ r.learner.name }}</div>
              <div class="text-caption text-muted">{{ r.learner.email }}</div>
            </td>
            <td style="min-width: 160px">
              <div class="d-flex align-center ga-2">
                <span class="bar" role="progressbar" :aria-label="`${r.learner.name} progress`" :aria-valuenow="r.percent" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${r.percent}%` }" /></span>
                <span class="text-caption text-muted text-no-wrap">{{ r.completedLessons }}/{{ r.totalLessons }}</span>
              </div>
            </td>
            <td><StatusPill :label="learningStatusLabel[r.status as LearningStatus] ?? r.status" :tone="tone(r.status)" /></td>
            <td class="text-no-wrap">
              <template v-if="r.lastAttempt && r.lastAttempt.score !== null">{{ r.lastAttempt.score }}/{{ r.lastAttempt.maxScore }}</template>
              <span v-else class="text-muted">—</span>
              <div class="text-caption text-muted">{{ r.attemptsThisCycle }} {{ r.attemptsThisCycle === 1 ? 'attempt' : 'attempts' }}</div>
            </td>
            <td>{{ r.cycle }}</td>
            <td class="text-no-wrap text-muted">{{ date(r.lastActivity) }}</td>
            <td class="text-right text-no-wrap">
              <router-link v-if="r.lastAttempt?.status === 'PENDING_REVIEW'" :to="`${gradingBase}/${r.lastAttempt.id}`" class="row-btn">Grade</router-link>
              <router-link v-else-if="r.certificate" :to="`/certificates/${r.certificate}`" class="row-link">Certificate</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--ot-border);
  overflow: hidden;
}
.bar > span {
  display: block;
  height: 6px;
  background: var(--ot-accent);
}
</style>
