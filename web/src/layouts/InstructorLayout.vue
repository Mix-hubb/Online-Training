<script setup lang="ts">
// Instructor layout (mockup): sidebar + white top bar + page.
import { ref } from 'vue';
import InstructorSidebar from '@/components/instructor/InstructorSidebar.vue';
import StaffTopbar from '@/components/common/StaffTopbar.vue';

const drawer = ref<boolean | null>(null); // null = Vuetify decides (open on desktop, closed on mobile)
</script>

<template>
  <InstructorSidebar v-model="drawer" />
  <StaffTopbar @menu="drawer = !drawer" />
  <v-main>
    <slot />
  </v-main>
</template>
