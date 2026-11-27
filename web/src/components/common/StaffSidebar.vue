<script setup lang="ts">
// Sidebar shared by the admin, instructor and partner areas (mockup): brand + area name,
// flat list with optional count badges. "View site" and "Log out" are in the top bar's account menu.
import { useDisplay } from 'vuetify';
import BrandMark from './BrandMark.vue';

export type StaffNavItem = { to: string; title: string; exact?: boolean; count?: number; icon?: string };

// Default icon for each staff page; an item can pass its own.
const ICONS: Record<string, string> = {
  '/admin': 'mdi-view-dashboard-outline',
  '/admin/courses': 'mdi-book-open-page-variant-outline',
  '/admin/grading': 'mdi-clipboard-check-outline',
  '/admin/support': 'mdi-inbox-outline',
  '/admin/payments/review': 'mdi-receipt-text-outline',
  '/admin/instructors': 'mdi-account-tie-outline',
  '/admin/partners': 'mdi-handshake-outline',
  '/admin/revenue': 'mdi-chart-pie',
  '/admin/landing': 'mdi-home-edit-outline',
  '/admin/reviews': 'mdi-star-outline',
  '/admin/taxonomy': 'mdi-tag-multiple-outline',
  '/admin/users': 'mdi-account-group-outline',
  '/admin/certificate': 'mdi-certificate-outline',
  '/admin/settings': 'mdi-cog-outline',
  '/admin/audit': 'mdi-history',
  '/instructor': 'mdi-book-open-page-variant-outline',
  '/instructor/grading': 'mdi-clipboard-check-outline',
  '/instructor/messages': 'mdi-message-text-outline',
  '/instructor/earnings': 'mdi-cash-multiple',
  '/instructor/profile': 'mdi-account-card-outline',
  '/partner/revenue-sharing': 'mdi-chart-pie',
  '/partner/payouts': 'mdi-bank-transfer',
  '/account/change-password': 'mdi-lock-outline',
};
const iconFor = (i: StaffNavItem) => i.icon ?? ICONS[i.to] ?? 'mdi-circle-small';

defineProps<{ area: string; items: StaffNavItem[]; navLabel: string }>();
const open = defineModel<boolean | null>({ default: null });
// Same rule as the top bar's menu button (StaffTopbar: shown below md). Vuetify's own default treats
// every iPad / phone OS as "mobile" and any width under 1280 px too, so on an iPad the drawer hid
// itself while the top bar showed no menu button: no way to open it (2026-11-24).
const { mdAndUp } = useDisplay();
</script>

<template>
  <v-navigation-drawer v-model="open" :mobile="!mdAndUp" width="248" class="staff-side" border="0">
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
            <span class="d-flex align-center ga-3"><v-icon :icon="iconFor(i)" size="20" class="side-ico" />{{ i.title }}</span>
            <span v-if="i.count" class="badge">{{ i.count }}</span>
          </router-link>
        </li>
      </ul>
    </nav>
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
  font-family: var(--ot-font-display);
  font-weight: 700;
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
  position: relative;
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
.side-ico {
  color: var(--ot-faint);
  transition: color var(--ot-transition);
}
.side-item:hover .side-ico {
  color: var(--ot-text-2);
}
.side-item.on {
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
  font-weight: 600;
}
.side-item.on .side-ico {
  color: var(--ot-accent);
}
/* Bar on the left edge of the current page */
.side-item.on::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 2px;
  background: var(--ot-accent);
}
.badge {
  font-size: 11px;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--ot-radius-control);
  background: var(--ot-hl);
  color: var(--ot-navy);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
