<script setup lang="ts">
// Sidebar shared by the admin, instructor and partner areas (mockup): brand + area name,
// flat list with optional count badges, and "View site" + "Log out" at the bottom.
import { useRouter } from 'vue-router';
import BrandMark from './BrandMark.vue';
import { useAuthStore } from '@/stores/auth';

export type StaffNavItem = { to: string; title: string; exact?: boolean; count?: number };

defineProps<{ area: string; items: StaffNavItem[]; navLabel: string; viewSiteLabel?: string }>();
const open = defineModel<boolean | null>({ default: null });
const auth = useAuthStore();
const router = useRouter();

async function logout() {
  await auth.logout();
  await router.push('/login');
}
</script>

<template>
  <v-navigation-drawer v-model="open" width="248" class="staff-side" border="0">
    <div class="brand">
      <BrandMark />
      <div class="d-flex flex-column">
        <span class="brand-name">Online Training</span>
        <span class="brand-role">{{ area }}</span>
      </div>
    </div>
    <nav :aria-label="navLabel">
      <ul class="side-list">
        <li v-for="i in items" :key="i.to">
          <router-link :to="i.to" class="side-item" :exact-active-class="i.exact ? 'on' : ''" :active-class="i.exact ? '' : 'on'">
            <span>{{ i.title }}</span>
            <span v-if="i.count" class="badge">{{ i.count }}</span>
          </router-link>
        </li>
      </ul>
    </nav>
    <template #append>
      <div class="d-flex flex-column ga-2 pa-4">
        <slot name="footer" />
        <router-link to="/" class="side-out">← {{ viewSiteLabel ?? 'View site' }}</router-link>
        <button type="button" class="side-out" @click="logout">Log out</button>
      </div>
    </template>
  </v-navigation-drawer>
</template>

<style scoped>
.staff-side {
  background: var(--ot-raised) !important;
  border-right: 1px solid var(--ot-border) !important;
  color: var(--ot-text);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 22px 24px;
}
.brand-name {
  font-weight: 600;
  font-size: 15px;
}
.brand-role {
  font-size: 11px;
  color: var(--ot-accent);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.side-list {
  list-style: none;
  margin: 0;
  padding: 0 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.side-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: var(--ot-radius-control);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--ot-text-2);
}
.side-item:hover {
  background: var(--ot-deep);
}
.side-item.on {
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
}
.badge {
  font-size: 11px;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--ot-radius-control);
  background: var(--ot-accent);
  color: var(--ot-surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.side-out {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 12px;
  border-radius: var(--ot-radius-control);
  border: 1px solid var(--ot-border);
  color: var(--ot-muted);
  text-decoration: none;
  font-size: 14px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}
.side-out:hover {
  background: var(--ot-surface);
  color: var(--ot-text);
}
</style>
