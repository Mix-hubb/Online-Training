<script setup lang="ts">
// Logo mark from the mockup: outlined rounded square with a play triangle.
withDefaults(defineProps<{ size?: number }>(), { size: 28 });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 28 28" aria-hidden="true" class="flex-shrink-0">
    <rect x="1" y="1" width="26" height="26" rx="7" style="fill: var(--ot-deep); stroke: var(--ot-accent)" stroke-width="1.5" />
    <path d="M11 9l8 5-8 5z" style="fill: var(--ot-accent)" />
  </svg>
</template>
