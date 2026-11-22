<script setup lang="ts">
// Grading queue (mockup AdminGrading, left column). Oldest first; the open attempt has a blue edge.
import type { GradingRow } from '@/api/admin/grading';
import { dateTime } from '@/utils/format';

defineProps<{ rows: GradingRow[]; base: string; selectedId?: string | null }>();
</script>

<template>
  <aside class="queue panel" aria-label="Grading queue">
    <div class="qhead"><span>Waiting ({{ rows.length }})</span><span class="text-muted font-weight-regular">Oldest first</span></div>
    <div v-if="!rows.length" class="pa-6 text-center">
      <v-icon icon="mdi-check-all" size="32" color="success" class="mb-2" />
      <div class="font-weight-bold text-body-2">Nothing to grade</div>
      <div class="text-caption text-muted">Attempts with written answers appear here.</div>
    </div>
    <ul v-else class="qlist">
      <li v-for="r in rows" :key="r.attemptId">
        <router-link :to="`${base}/${r.attemptId}`" class="qrow" :class="{ on: selectedId === r.attemptId }" :aria-current="selectedId === r.attemptId ? 'page' : undefined">
          <span class="font-weight-bold text-body-2">{{ r.learner.name }}</span>
          <span class="text-caption text-muted">{{ r.course.title }}</span>
          <span class="text-caption text-muted">{{ dateTime(r.submittedAt) }}<template v-if="r.cycle > 1"> · Round {{ r.cycle }}</template></span>
        </router-link>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.queue {
  flex: 1 1 300px;
  max-width: 360px;
  overflow: hidden;
}
.qhead {
  padding: 14px 18px;
  border-bottom: 1px solid var(--ot-border);
  font-size: 14px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
}
.qlist {
  list-style: none;
  margin: 0;
  padding: 0;
}
.qrow {
  padding: 14px 18px 14px 15px;
  border-bottom: 1px solid var(--ot-border);
  border-left: 3px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-decoration: none;
  color: var(--ot-text);
}
.qrow:hover {
  background: var(--ot-raised);
}
.qrow.on {
  border-left-color: var(--ot-accent);
  background: var(--ot-info-bg);
}
@media (max-width: 760px) {
  .queue {
    max-width: none;
  }
}
</style>
