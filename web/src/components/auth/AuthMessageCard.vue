<script setup lang="ts">
// Centered card used by auth pages (verify, forgot, reset, change password).
defineProps<{ title: string; icon?: string; tone?: 'success' | 'warning' | 'error' | 'info' }>();
</script>

<template>
  <div class="page auth-wrap">
    <div class="auth-col">
      <section class="panel auth-card center">
        <div v-if="icon" class="auth-icon" :class="tone"><v-icon :icon="icon" size="28" /></div>
        <h1>{{ title }}</h1>
        <div class="w-100 text-body-2 text-muted" style="line-height: 1.6"><slot /></div>
      </section>
    </div>
  </div>
</template>
