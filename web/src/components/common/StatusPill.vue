<script setup lang="ts">
// Small status pill. tone: success | warning | danger | info | neutral.
defineProps<{ label: string; tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; icon?: string }>();
</script>

<template>
  <span class="pill" :class="tone && tone !== 'info' ? tone : ''">
    <v-icon v-if="icon" :icon="icon" size="14" />
    {{ label }}
  </span>
</template>
