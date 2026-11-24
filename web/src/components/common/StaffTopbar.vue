<script setup lang="ts">
// White 60px top bar for staff areas (mockup): menu button on mobile, bell, account menu.
// "View site" and "Log out" are in the account menu (2026-11-24), not as separate buttons.
import { useDisplay } from 'vuetify';
import AccountMenu from './AccountMenu.vue';
import NotificationBell from './NotificationBell.vue';

withDefaults(defineProps<{ bell?: boolean; name?: string }>(), { bell: true, name: undefined });
defineEmits<{ menu: [] }>();
const { mdAndUp } = useDisplay();
</script>

<template>
  <v-app-bar flat color="surface" height="60" class="staff-top">
    <v-app-bar-nav-icon v-if="!mdAndUp" aria-label="Open menu" @click="$emit('menu')" />
    <v-spacer />
    <div class="d-flex align-center ga-2 pr-4 pr-sm-6">
      <NotificationBell v-if="bell" framed />
      <AccountMenu place="staff" :name="name" />
    </div>
  </v-app-bar>
</template>

<style scoped>
.staff-top {
  border-bottom: 1px solid var(--ot-border) !important;
}
</style>
