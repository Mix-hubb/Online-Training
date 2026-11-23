<script setup lang="ts">
// Period picker for revenue reports: a whole month (with previous / next month) or specific days.
import { addMonths, monthKey, type Period } from '@/utils/period';

const p = defineModel<Period>({ required: true });
const id = `per-${Math.random().toString(36).slice(2, 8)}`;
const current = monthKey(new Date());

function setMode(mode: Period['mode']) {
  if (mode === p.value.mode) return;
  if (mode === 'days') {
    // Start the day range inside the month that was being looked at.
    const first = `${p.value.month}-01`;
    p.value = { ...p.value, mode, from: first, to: first };
  } else {
    p.value = { ...p.value, mode, month: (p.value.from || '').slice(0, 7) || current };
  }
}
const shift = (n: number) => (p.value = { ...p.value, month: addMonths(p.value.month, n) });
</script>

<template>
  <div class="period" role="group" aria-label="Report period">
    <div class="chipbar" role="group" aria-label="Period type">
      <button type="button" :aria-pressed="p.mode === 'month'" @click="setMode('month')">Month</button>
      <button type="button" :aria-pressed="p.mode === 'days'" @click="setMode('days')">Specific days</button>
    </div>
    <div v-if="p.mode === 'month'" class="d-flex align-center ga-1">
      <button type="button" class="step" aria-label="Previous month" @click="shift(-1)"><v-icon icon="mdi-chevron-left" size="20" /></button>
      <label :for="`${id}-m`" class="sr-only">Month</label>
      <input :id="`${id}-m`" v-model="p.month" type="month" class="ot-input month" :max="current" />
      <button type="button" class="step" aria-label="Next month" :disabled="p.month >= current" @click="shift(1)"><v-icon icon="mdi-chevron-right" size="20" /></button>
    </div>
    <div v-else class="d-flex align-center flex-wrap ga-2">
      <label :for="`${id}-f`" class="text-body-2 text-muted">From</label>
      <input :id="`${id}-f`" v-model="p.from" type="date" class="ot-input day" />
      <label :for="`${id}-t`" class="text-body-2 text-muted">to</label>
      <input :id="`${id}-t`" v-model="p.to" type="date" class="ot-input day" :min="p.from" />
    </div>
  </div>
</template>

<style scoped>
.period {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}
.month {
  width: 180px;
}
.day {
  width: 170px;
}
.step {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ot-input-border);
  border-radius: var(--ot-radius-control);
  background: var(--ot-surface);
  color: var(--ot-text);
  cursor: pointer;
}
.step:hover:not(:disabled) {
  border-color: var(--ot-muted);
}
.step:disabled {
  color: var(--ot-faint);
  cursor: not-allowed;
  opacity: 0.6;
}
.step:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: 2px;
}
@media (max-width: 600px) {
  .month,
  .day {
    width: auto;
    flex: 1 1 140px;
  }
}
</style>
