<script setup lang="ts">
// The one account menu (2026-11-24), used by the learner header and the staff top bar.
// Switching between the site and the admin / instructor / partner area, and logging out, live only here
// (they used to be spread over a header button, a "View site" button and the sidebar footer).
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { homeFor, useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';
import { initials } from '@/utils/format';

/** site = learner pages, staff = admin / instructor / partner area. */
const props = defineProps<{ place: 'site' | 'staff'; name?: string }>();
const auth = useAuthStore();
const notes = useNotificationsStore();
const router = useRouter();

const user = computed(() => auth.user!);
const shown = computed(() => props.name ?? user.value.name);
const learner = computed(() => user.value.role !== 'PARTNER');
const roleLabel: Record<string, string> = { ADMIN: 'Admin', INSTRUCTOR: 'Instructor', PARTNER: 'Partner', USER: 'Learner' };

// The one switch: from the site to your work area, or from the work area back to the site.
const switchTo = computed(() => {
  const r = user.value.role;
  if (props.place === 'staff') return { to: '/', title: learner.value ? 'View site as learner' : 'View site', icon: 'mdi-swap-horizontal' };
  if (r === 'ADMIN') return { to: '/admin', title: 'Admin dashboard', icon: 'mdi-swap-horizontal' };
  if (r === 'INSTRUCTOR') return { to: '/instructor', title: 'Instructor area', icon: 'mdi-swap-horizontal' };
  if (r === 'PARTNER') return { to: homeFor(r), title: 'Revenue sharing', icon: 'mdi-swap-horizontal' };
  return null;
});

async function logout() {
  await auth.logout();
  notes.stop();
  await router.push(props.place === 'staff' ? '/login' : '/');
}
</script>

<template>
  <v-menu location="bottom end" offset="6">
    <template #activator="{ props: act }">
      <button v-bind="act" type="button" class="account-chip" :aria-label="`Account menu for ${shown}`">
        <v-avatar size="30" color="primary-tint">
          <v-img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" referrerpolicy="no-referrer" />
          <span v-else class="mark">{{ initials(shown) }}</span>
        </v-avatar>
        <span class="d-none d-sm-inline nm">{{ shown.split(' ')[0] }}</span>
        <v-icon icon="mdi-chevron-down" size="18" class="d-none d-sm-inline chev" aria-hidden="true" />
      </button>
    </template>
    <v-list density="compact" min-width="240" class="py-1">
      <v-list-item :title="shown" :subtitle="user.email">
        <template #append><span class="role">{{ roleLabel[user.role] }}</span></template>
      </v-list-item>
      <template v-if="switchTo">
        <v-divider class="my-1" />
        <v-list-item :to="switchTo.to" :prepend-icon="switchTo.icon" :title="switchTo.title" class="switch" />
      </template>
      <v-divider class="my-1" />
      <template v-if="learner">
        <v-list-item to="/profile" prepend-icon="mdi-account-outline" title="Profile and learning" />
        <v-list-item to="/profile/orders" prepend-icon="mdi-receipt-text-outline" title="Orders and receipts" />
      </template>
      <v-list-item v-if="user.hasPassword" to="/account/change-password" prepend-icon="mdi-lock-outline" title="Change password" />
      <v-list-item prepend-icon="mdi-logout" title="Log out" @click="logout" />
    </v-list>
  </v-menu>
</template>

<style scoped>
/* 40px, same box as the notification bell beside it. */
.account-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 4px;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-control);
  background: var(--ot-surface);
  color: var(--ot-text);
  cursor: pointer;
  transition: background var(--ot-transition);
}
.account-chip:hover {
  background: var(--ot-raised);
}
.account-chip:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: 2px;
}
@media (min-width: 600px) {
  .account-chip {
    padding: 0 10px 0 4px;
  }
}
.mark {
  font-size: 12px;
  font-weight: 700;
  color: var(--ot-accent-tint-text);
}
.nm {
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}
.chev {
  color: var(--ot-muted);
}
.role {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
}
.switch :deep(.v-list-item-title) {
  font-weight: 600;
  color: var(--ot-accent-strong);
}
</style>
