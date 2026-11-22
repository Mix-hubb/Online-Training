<script setup lang="ts">
// Instructor grading: queue (assigned courses only) or one attempt.
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import GradingForm from '@/components/staff/GradingForm.vue';
import GradingQueue from '@/components/staff/GradingQueue.vue';
import * as insApi from '@/api/instructor';
import { errorMessage } from '@/api/client';
import type { GradingAttempt, GradingRow } from '@/api/admin/grading';

const route = useRoute();
const router = useRouter();
const rows = ref<GradingRow[] | null>(null);
const attempt = ref<GradingAttempt | null>(null);
const saving = ref(false);
const msg = ref('');
const err = ref('');

async function load() {
  err.value = '';
  attempt.value = null;
  const id = route.params.attemptId ? String(route.params.attemptId) : null;
  try {
    rows.value = await insApi.gradingQueue();
    if (id) attempt.value = await insApi.gradingAttempt(id);
  } catch (e) {
    err.value = errorMessage(e);
  }
}
onMounted(load);
watch(() => route.params.attemptId, load);
async function save(g: { questionId: string; points: number; comment?: string }[]) {
  saving.value = true;
  try {
    const r = await insApi.grade(attempt.value!.id, g);
    msg.value = `Saved: ${r.score}/${r.maxScore}, ${r.passed ? 'passed' : 'not passed'}. The learner was notified.`;
    const next = rows.value?.find((x) => x.attemptId !== attempt.value?.id);
    await router.push(next ? `/instructor/grading/${next.attemptId}` : '/instructor/grading');
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Grading" subtitle="Written answers from learners in your courses. The learner is notified when you save." :back="route.params.attemptId ? '/instructor/grading' : undefined" />
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <v-skeleton-loader v-if="!rows" type="table" color="surface" />
    <div v-else class="grade-split">
      <GradingQueue :rows="rows" base="/instructor/grading" :selected-id="route.params.attemptId ? String(route.params.attemptId) : null" />
      <GradingForm v-if="attempt" :attempt="attempt" :saving="saving" :readonly="attempt.status !== 'PENDING_REVIEW'" @save="save" />
      <v-skeleton-loader v-else-if="route.params.attemptId && !err" type="article" color="surface" style="flex: 999 1 460px" />
      <div v-else-if="rows.length" class="panel pick">
        <v-icon icon="mdi-clipboard-text-outline" size="32" color="primary" />
        <div class="font-weight-bold">Choose an attempt</div>
        <div class="text-body-2 text-muted">Open the oldest one first so learners wait the least.</div>
        <v-btn color="primary" :to="`/instructor/grading/${rows[0]!.attemptId}`">Grade the oldest</v-btn>
      </div>
    </div>
    <v-snackbar :model-value="!!msg" :timeout="5000" @update:model-value="msg = ''">{{ msg }}</v-snackbar>
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
