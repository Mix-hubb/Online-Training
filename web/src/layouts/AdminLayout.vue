<script setup lang="ts">
// Admin layout (mockup): sidebar + white top bar + page on the light ground.
import { ref } from 'vue';
import AdminSidebar from '@/components/admin/AdminSidebar.vue';
import StaffTopbar from '@/components/common/StaffTopbar.vue';

const drawer = ref<boolean | null>(null); // null = Vuetify decides (open on desktop, closed on mobile)
</script>

<template>
  <AdminSidebar v-model="drawer" />
  <StaffTopbar @menu="drawer = !drawer" />
  <v-main>
    <slot />
  </v-main>
</template>
