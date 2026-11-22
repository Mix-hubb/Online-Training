<script setup lang="ts">
// Confirm dialog for destructive or important actions.
const open = defineModel<boolean>({ default: false });
defineProps<{ title: string; text?: string; confirmLabel?: string; danger?: boolean; loading?: boolean }>();
defineEmits<{ confirm: [] }>();
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card color="surface">
      <v-card-title class="pt-5 px-6">{{ title }}</v-card-title>
      <v-card-text class="px-6 text-body-2 text-muted">
        <slot>{{ text }}</slot>
      </v-card-text>
      <v-card-actions class="px-6 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn :color="danger ? 'error' : 'primary'" variant="flat" :loading="loading" @click="$emit('confirm')">{{ confirmLabel ?? 'Confirm' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
