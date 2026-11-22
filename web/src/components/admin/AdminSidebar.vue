<script setup lang="ts">
// Admin sidebar: shared StaffSidebar with the admin menu and queue counts (grading, support, bank slips).
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import StaffSidebar from '@/components/common/StaffSidebar.vue';
import * as dashApi from '@/api/admin/dashboard';

const open = defineModel<boolean | null>({ default: null });
const route = useRoute();
const counts = ref({ grading: 0, support: 0, slips: 0 });

const items = computed(() => [
  { to: '/admin', title: 'Dashboard', exact: true },
  { to: '/admin/courses', title: 'Courses' },
  { to: '/admin/grading', title: 'Grading', count: counts.value.grading },
  { to: '/admin/support', title: 'Support inbox', count: counts.value.support },
  { to: '/admin/payments/review', title: 'Bank slips', count: counts.value.slips },
  { to: '/admin/partners', title: 'Partners' },
  { to: '/admin/revenue', title: 'Revenue share' },
  { to: '/admin/landing', title: 'Landing page' },
  { to: '/admin/taxonomy', title: 'Categories and tags' },
  { to: '/admin/users', title: 'Users' },
  { to: '/admin/certificate', title: 'Certificate template' },
  { to: '/admin/settings', title: 'Settings' },
  { to: '/admin/audit', title: 'Audit log' },
]);

async function loadCounts() {
  try {
    const d = await dashApi.dashboard();
    counts.value = { grading: d.gradingWaiting, support: d.openSupport, slips: d.slipsWaiting };
  } catch {
    /* badges are optional */
  }
}
onMounted(loadCounts);
// Grading, slips and support change the counts: refresh after leaving those pages.
watch(
  () => route.path,
  (_to, from) => {
    if (from && /\/admin\/(grading|payments|support)/.test(from)) void loadCounts();
  },
);
</script>

<template>
  <StaffSidebar v-model="open" area="Admin" nav-label="Admin" :items="items" view-site-label="View site as user" />
</template>
