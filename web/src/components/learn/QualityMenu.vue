<script setup lang="ts">
// Video quality picker: Auto + available heights (max 1080p, 4K only when the course allows it).
defineProps<{ levels: number[]; current: number | 'auto' }>();
defineEmits<{ select: [number | 'auto'] }>();
const label = (h: number) => (h >= 2160 ? '4K' : `${h}p`);
</script>

<template>
  <v-menu location="top end">
    <template #activator="{ props }">
      <v-btn v-bind="props" size="small" variant="tonal" prepend-icon="mdi-cog-outline" aria-label="Video quality">{{ current === 'auto' ? 'Auto' : label(current) }}</v-btn>
    </template>
    <v-list density="compact" color="primary">
      <v-list-item :active="current === 'auto'" title="Auto" @click="$emit('select', 'auto')" />
      <v-list-item v-for="h in levels" :key="h" :active="current === h" :title="label(h)" @click="$emit('select', h)" />
    </v-list>
  </v-menu>
</template>
