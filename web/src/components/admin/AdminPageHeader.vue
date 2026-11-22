<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; back?: string }>();
</script>

<template>
  <div class="mb-6">
    <router-link v-if="back" :to="back" class="back-link">← Back</router-link>
    <div class="d-flex align-center flex-wrap ga-3">
      <div class="flex-grow-1">
        <h1 class="page-title mb-0">{{ title }}</h1>
        <p v-if="subtitle" class="page-sub">{{ subtitle }}</p>
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.back-link {
  display: inline-block;
  font-size: 13px;
  color: var(--ot-muted);
  text-decoration: none;
  margin-bottom: 8px;
}
.back-link:hover {
  color: var(--ot-text);
}
</style>
