<script setup lang="ts">
// Empty / error state block with an optional action.
defineProps<{ icon?: string; title: string; text?: string; actionLabel?: string; actionTo?: string }>();
defineEmits<{ action: [] }>();
</script>

<template>
  <div class="empty text-center py-12 px-4">
    <v-icon :icon="icon ?? 'mdi-inbox-outline'" size="40" class="text-muted mb-3" />
    <div class="text-subtitle-1 font-weight-bold mb-1">{{ title }}</div>
    <p v-if="text" class="text-body-2 text-muted mx-auto mb-4" style="max-width: 420px">{{ text }}</p>
    <slot>
      <v-btn v-if="actionLabel && actionTo" color="primary" :to="actionTo">{{ actionLabel }}</v-btn>
      <v-btn v-else-if="actionLabel" color="primary" @click="$emit('action')">{{ actionLabel }}</v-btn>
    </slot>
  </div>
</template>
