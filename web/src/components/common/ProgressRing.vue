<script setup lang="ts">
// Round progress meter with the percent in the middle. Turns green at 100 %.
import { computed } from 'vue';

const props = withDefaults(defineProps<{ percent: number; size?: number; label?: string }>(), { size: 56, label: 'Progress' });
const p = computed(() => Math.max(0, Math.min(100, Math.round(props.percent))));
const r = 15.5;
const c = 2 * Math.PI * r;
</script>

<template>
  <span class="ring" :class="{ done: p === 100 }" :style="{ width: `${size}px`, height: `${size}px` }" role="progressbar" :aria-label="label" :aria-valuenow="p" aria-valuemin="0" aria-valuemax="100">
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <circle class="track" cx="18" cy="18" :r="r" />
      <circle class="fill" cx="18" cy="18" :r="r" :stroke-dasharray="c" :stroke-dashoffset="c * (1 - p / 100)" />
    </svg>
    <span class="num">
      <v-icon v-if="p === 100" icon="mdi-check" size="20" />
      <template v-else>{{ p }}<small>%</small></template>
    </span>
  </span>
</template>

<style scoped>
.ring {
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
svg {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}
circle {
  fill: none;
  stroke-width: 3.5;
}
.track {
  stroke: var(--ot-border);
}
.fill {
  stroke: var(--ot-accent);
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s var(--ot-ease-out);
}
.done .fill {
  stroke: var(--ot-success);
}
.num {
  position: relative;
  font-family: var(--ot-font-display);
  font-size: 14px;
  font-weight: 800;
  color: var(--ot-text);
  font-variant-numeric: tabular-nums;
}
.num small {
  font-size: 10px;
  font-weight: 700;
  color: var(--ot-muted);
}
.done .num {
  color: var(--ot-success);
}
@media (prefers-reduced-motion: reduce) {
  .fill {
    transition: none;
  }
}
</style>
