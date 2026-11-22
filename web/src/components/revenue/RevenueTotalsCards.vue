<script setup lang="ts">
// Earned / paid / outstanding per currency. USD and THB are shown separately, never added.
import type { RevenueTotals } from '@/types';
import { money } from '@/utils/format';
defineProps<{ totals: RevenueTotals }>();
</script>

<template>
  <div v-if="!Object.keys(totals).length" class="panel pa-5 text-body-2 text-muted">No revenue yet.</div>
  <div v-else class="tiles">
    <template v-for="(t, cur) in totals" :key="cur">
      <div class="stat panel">
        <span class="stat-label">Earned · {{ String(cur).toUpperCase() }}</span>
        <span class="stat-value">{{ money(t.earned, String(cur)) }}</span>
      </div>
      <div class="stat panel">
        <span class="stat-label">Paid out · {{ String(cur).toUpperCase() }}</span>
        <span class="stat-value">{{ money(t.paid, String(cur)) }}</span>
      </div>
      <div class="stat panel">
        <span class="stat-label">Outstanding · {{ String(cur).toUpperCase() }}</span>
        <span class="stat-value" style="color: var(--ot-warning)">{{ money(t.outstanding, String(cur)) }}</span>
        <span class="stat-note">Not yet paid out</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
</style>
