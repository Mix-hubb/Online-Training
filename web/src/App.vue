<script setup lang="ts">
// Root: layout is chosen per route via route.meta.layout ('public' | 'admin' | 'instructor' | 'partner').
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import PublicLayout from '@/layouts/PublicLayout.vue';
import AdminLayout from '@/layouts/AdminLayout.vue';
import InstructorLayout from '@/layouts/InstructorLayout.vue';
import PartnerLayout from '@/layouts/PartnerLayout.vue';

const route = useRoute();
const layouts = { admin: AdminLayout, instructor: InstructorLayout, partner: PartnerLayout, public: PublicLayout };
const layout = computed(() => layouts[route.meta.layout ?? 'public']);
// Pages that load data from route params on mount must remount when the path changes
// (e.g. /certificates/A -> /certificates/B). Pages that watch their own params keep one instance.
const selfManaged = new Set(['messages', 'admin-support', 'instructor-messages', 'instructor-grading', 'admin-course-new', 'admin-course-edit']);
const viewKey = (r: typeof route) => {
  const name = String(r.name ?? '');
  if (name === 'admin-course-new' || name === 'admin-course-edit') return 'admin-course-editor'; // create -> edit keeps state
  return selfManaged.has(name) ? name : r.path;
};
</script>

<template>
  <v-app>
    <component :is="layout">
      <router-view v-slot="{ Component, route: r }">
        <component :is="Component" :key="viewKey(r)" />
      </router-view>
    </component>
  </v-app>
</template>
