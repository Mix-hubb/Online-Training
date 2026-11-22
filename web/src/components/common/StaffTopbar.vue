<script setup lang="ts">
// White 60px top bar for staff areas (mockup): menu button on mobile, View site, bell, account chip.
import { useDisplay } from 'vuetify';
import NotificationBell from './NotificationBell.vue';
import { useAuthStore } from '@/stores/auth';
import { initials } from '@/utils/format';

withDefaults(defineProps<{ bell?: boolean; viewSiteLabel?: string; name?: string }>(), { bell: true });
defineEmits<{ menu: [] }>();
const { mdAndUp } = useDisplay();
const auth = useAuthStore();
</script>

<template>
  <v-app-bar flat color="surface" height="60" class="staff-top">
    <v-app-bar-nav-icon v-if="!mdAndUp" aria-label="Open menu" @click="$emit('menu')" />
    <v-spacer />
    <div class="d-flex align-center ga-3 pr-4 pr-sm-6">
      <v-btn variant="outlined" to="/" height="40" class="d-none d-sm-flex">{{ viewSiteLabel ?? 'View site' }}</v-btn>
      <NotificationBell v-if="bell" framed />
      <span class="who">
        <span class="who-mark">{{ initials(name ?? auth.user?.name ?? '') }}</span>
        <span class="d-none d-sm-inline">{{ name ?? auth.user?.name }}</span>
      </span>
    </div>
  </v-app-bar>
</template>

<style scoped>
.staff-top {
  border-bottom: 1px solid var(--ot-border) !important;
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 3px;
  border: 1px solid var(--ot-input-border);
  border-radius: var(--ot-radius-control);
  background: var(--ot-surface);
  font-size: 14px;
  font-weight: 500;
}
@media (min-width: 600px) {
  .who {
    padding-right: 12px;
  }
}
.who-mark {
  width: 32px;
  height: 32px;
  border-radius: 3px;
  background: var(--ot-accent-tint);
  color: var(--ot-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}
</style>
