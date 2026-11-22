<script setup lang="ts">
// Partner layout (mockup): sidebar (Revenue sharing, Payouts) + top bar + page. No learner header/footer.
import { computed, ref } from 'vue';
import StaffSidebar from '@/components/common/StaffSidebar.vue';
import StaffTopbar from '@/components/common/StaffTopbar.vue';
import { useAuthStore } from '@/stores/auth';

const drawer = ref<boolean | null>(null);
const auth = useAuthStore();
const items = computed(() => [
  { to: '/partner/revenue-sharing', title: 'Revenue sharing' },
  { to: '/partner/payouts', title: 'Payouts' },
  ...(auth.user?.role === 'INSTRUCTOR' ? [{ to: '/instructor', title: 'Instructor area' }] : []),
  { to: '/account/change-password', title: 'Change password' },
]);
const name = computed(() => auth.user?.partner?.name ?? auth.user?.name);
</script>

<template>
  <StaffSidebar v-model="drawer" area="Partner" nav-label="Partner" :items="items" />
  <StaffTopbar :bell="false" :name="name" @menu="drawer = !drawer" />
  <v-main>
    <slot />
  </v-main>
</template>
