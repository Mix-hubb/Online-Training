<script setup lang="ts">
// Read-only stars (supports halves for averages). The number is announced, the icons are decoration.
import { computed } from 'vue';

const props = withDefaults(defineProps<{ value: number | null; size?: number; label?: string }>(), { size: 16, label: '' });
const icons = computed(() =>
  [1, 2, 3, 4, 5].map((i) => {
    const v = props.value ?? 0;
    if (v >= i - 0.25) return 'mdi-star';
    if (v >= i - 0.75) return 'mdi-star-half-full';
    return 'mdi-star-outline';
  }),
);
</script>

<template>
  <span class="stars" role="img" :aria-label="label || (value ? `${value} out of 5 stars` : 'No rating yet')">
    <v-icon v-for="(ic, i) in icons" :key="i" :icon="ic" :size="size" :class="{ off: ic === 'mdi-star-outline' }" aria-hidden="true" />
  </span>
</template>

<style scoped>
.stars {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  color: var(--ot-star);
  line-height: 1;
}
.off {
  color: var(--ot-faint);
}
</style>
