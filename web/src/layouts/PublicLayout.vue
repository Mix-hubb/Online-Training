<script setup lang="ts">
// Public layout: AppHeader + page + AppFooter.
import AppHeader from '@/components/common/AppHeader.vue';
import AppFooter from '@/components/common/AppFooter.vue';
</script>

<template>
  <AppHeader />
  <v-main>
    <slot />
  </v-main>
  <AppFooter />
</template>
