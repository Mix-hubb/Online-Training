<script setup lang="ts">
// Admin grading (mockup AdminGrading): queue on the left, pick an attempt to grade it.
import { onMounted, ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import GradingQueue from '@/components/staff/GradingQueue.vue';
import * as api from '@/api/admin/grading';

const rows = ref<api.GradingRow[] | null>(null);
onMounted(async () => (rows.value = await api.queue().catch(() => [])));
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Grading" subtitle="Written answers waiting for a score. The learner is notified in the app when you save." />
    <v-skeleton-loader v-if="!rows" type="table" color="surface" />
    <div v-else class="grade-split">
      <GradingQueue :rows="rows" base="/admin/grading" />
      <div v-if="rows.length" class="panel pick">
        <v-icon icon="mdi-clipboard-text-outline" size="32" color="primary" />
        <div class="font-weight-bold">Choose an attempt</div>
        <div class="text-body-2 text-muted">Open the oldest one first so learners wait the least.</div>
        <v-btn color="primary" :to="`/admin/grading/${rows[0]!.attemptId}`">Grade the oldest</v-btn>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pick {
  flex: 999 1 460px;
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
}
</style>
