<script setup lang="ts">
// Instructor sidebar: shared StaffSidebar with grading and unread-message counts.
import { computed, onMounted, ref } from 'vue';
import StaffSidebar from '@/components/common/StaffSidebar.vue';
import * as insApi from '@/api/instructor';
import { useAuthStore } from '@/stores/auth';

const open = defineModel<boolean | null>({ default: null });
const auth = useAuthStore();
const counts = ref({ grading: 0, unread: 0 });

const items = computed(() => [
  { to: '/instructor', title: 'My courses', exact: true },
  { to: '/instructor/grading', title: 'Grading', count: counts.value.grading },
  { to: '/instructor/messages', title: 'Messages', count: counts.value.unread },
  { to: '/instructor/earnings', title: 'Earnings' },
  ...(auth.user?.hasPassword ? [{ to: '/account/change-password', title: 'Change password' }] : []),
]);

onMounted(async () => {
  try {
    const d = await insApi.dashboard();
    counts.value = { grading: d.gradingWaiting, unread: d.unreadThreads };
  } catch {
    /* badges are optional */
  }
});
</script>

<template>
  <StaffSidebar v-model="open" area="Instructor" nav-label="Instructor" :items="items" />
</template>
