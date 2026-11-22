<script setup lang="ts">
// Admin grading, one attempt: queue on the left, answers and scoring on the right.
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import GradingForm from '@/components/staff/GradingForm.vue';
import GradingQueue from '@/components/staff/GradingQueue.vue';
import * as api from '@/api/admin/grading';
import { errorMessage } from '@/api/client';

const route = useRoute();
const router = useRouter();
const id = String(route.params.attemptId);
const a = ref<api.GradingAttempt | null>(null);
const rows = ref<api.GradingRow[]>([]);
const saving = ref(false);
const err = ref('');
onMounted(async () => {
  api
    .queue()
    .then((r) => (rows.value = r))
    .catch(() => undefined);
  try {
    a.value = await api.attempt(id);
  } catch (e) {
    err.value = errorMessage(e);
  }
});
async function save(g: { questionId: string; points: number; comment?: string }[]) {
  saving.value = true;
  err.value = '';
  try {
    await api.grade(a.value!.id, g);
    const next = rows.value.find((r) => r.attemptId !== id);
    await router.push(next ? `/admin/grading/${next.attemptId}` : '/admin/grading');
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Grading" subtitle="Written answers waiting for a score. The learner is notified in the app when you save." back="/admin/grading" />
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <div class="grade-split">
      <GradingQueue :rows="rows" base="/admin/grading" :selected-id="id" />
      <GradingForm v-if="a" :attempt="a" :saving="saving" :readonly="a.status !== 'PENDING_REVIEW'" @save="save" />
      <v-skeleton-loader v-else-if="!err" type="article" color="surface" style="flex: 999 1 460px" />
    </div>
  </div>
</template>
