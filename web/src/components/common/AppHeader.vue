<script setup lang="ts">
// Header: logo, Courses, My learning, Messages, bell, avatar menu; logged out: Log in + Sign up.
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import BrandMark from './BrandMark.vue';
import NotificationBell from './NotificationBell.vue';
import { homeFor, useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';
import { initials } from '@/utils/format';

const auth = useAuthStore();
const notes = useNotificationsStore();
const router = useRouter();
const { mdAndUp } = useDisplay();
const drawer = ref(false);

const staffLink = computed(() => {
  const r = auth.user?.role;
  if (r === 'ADMIN') return { to: '/admin', label: 'Admin' };
  if (r === 'INSTRUCTOR') return { to: '/instructor', label: 'Instructor' };
  if (r === 'PARTNER') return { to: homeFor(r), label: 'Revenue sharing' };
  return null;
});

async function logout() {
  await auth.logout();
  notes.stop();
  await router.push('/');
}
</script>

<template>
  <v-app-bar flat color="background" border="b" height="72">
    <v-container fluid class="bar d-flex align-center py-0">
      <v-app-bar-nav-icon v-if="!mdAndUp" aria-label="Open menu" @click="drawer = !drawer" />
      <router-link to="/" class="d-flex align-center text-decoration-none mr-6 brand-link" aria-label="Online Training home">
        <BrandMark class="mr-2" />
        <span class="brand-name d-none d-sm-inline">Online Training</span>
      </router-link>
      <template v-if="mdAndUp">
        <nav aria-label="Main" class="d-flex align-center ga-6 main-nav">
          <router-link to="/" exact-active-class="active">Courses</router-link>
          <router-link v-if="auth.user && auth.user.role !== 'PARTNER'" to="/profile" active-class="active">My learning</router-link>
          <router-link v-if="auth.user && auth.user.role !== 'PARTNER'" to="/messages" active-class="active">Messages</router-link>
        </nav>
      </template>
      <v-spacer />
      <template v-if="auth.user">
        <v-btn v-if="staffLink && mdAndUp" variant="tonal" color="primary" :to="staffLink.to" class="mr-3">{{ staffLink.label }}</v-btn>
        <NotificationBell framed />
        <v-menu location="bottom end">
          <template #activator="{ props }">
            <button v-bind="props" type="button" class="account-chip ml-3" :aria-label="`Account menu for ${auth.user.name}`">
              <v-avatar size="34" color="primary-tint">
                <v-img v-if="auth.user.avatarUrl" :src="auth.user.avatarUrl" :alt="auth.user.name" />
                <span v-else class="text-caption font-weight-bold" style="color: var(--ot-accent-tint-text)">{{ initials(auth.user.name) }}</span>
              </v-avatar>
              <span class="d-none d-sm-inline text-body-2 font-weight-medium">{{ auth.user.name.split(' ')[0] }}</span>
            </button>
          </template>
          <v-list density="compact" min-width="220" class="py-1">
            <v-list-item :title="auth.user.name" :subtitle="auth.user.email" />
            <v-divider class="my-1" />
            <v-list-item v-if="auth.user.role !== 'PARTNER'" to="/profile" prepend-icon="mdi-account-outline" title="Profile and learning" />
            <v-list-item v-if="auth.user.role !== 'PARTNER'" to="/profile/orders" prepend-icon="mdi-receipt-text-outline" title="Orders and receipts" />
            <v-list-item v-if="staffLink" :to="staffLink.to" prepend-icon="mdi-view-dashboard-outline" :title="staffLink.label" />
            <v-list-item v-if="auth.user.hasPassword" to="/account/change-password" prepend-icon="mdi-lock-outline" title="Change password" />
            <v-list-item prepend-icon="mdi-logout" title="Log out" @click="logout" />
          </v-list>
        </v-menu>
      </template>
      <template v-else>
        <v-btn variant="text" to="/login" class="font-weight-medium">Log in</v-btn>
        <v-btn color="primary" variant="flat" to="/register" class="ml-3">Sign up</v-btn>
      </template>
    </v-container>
  </v-app-bar>
  <v-navigation-drawer v-if="!mdAndUp" v-model="drawer" temporary color="surface-variant">
    <v-list nav>
      <v-list-item to="/" title="Courses" prepend-icon="mdi-book-open-page-variant-outline" />
      <template v-if="auth.user && auth.user.role !== 'PARTNER'">
        <v-list-item to="/profile" title="My learning" prepend-icon="mdi-school-outline" />
        <v-list-item to="/messages" title="Messages" prepend-icon="mdi-message-outline" />
      </template>
      <v-list-item v-if="staffLink" :to="staffLink.to" :title="staffLink.label" prepend-icon="mdi-view-dashboard-outline" />
    </v-list>
  </v-navigation-drawer>
</template>

<style scoped>
/* Full width, same edges as the staff (admin) top bar: brand at the far left, account at the far right. */
.bar {
  max-width: none;
  padding-left: 22px;
  padding-right: 24px;
}
@media (max-width: 600px) {
  .bar {
    padding-left: 8px;
    padding-right: 16px;
  }
}
.brand-name {
  color: var(--ot-text);
  font-weight: 600;
  font-size: 17px;
}
.brand-link {
  min-height: var(--ot-control-h);
  min-width: var(--ot-control-h);
  justify-content: center;
  border-radius: var(--ot-radius-control);
}
.main-nav a {
  display: inline-flex;
  align-items: center;
  min-height: var(--ot-control-h);
  padding: 0 var(--ot-space-0-5);
  border-bottom: 2px solid transparent;
  color: var(--ot-muted);
  text-decoration: none;
  font-size: var(--ot-fs-base);
  font-weight: 500;
  transition: color var(--ot-transition), border-color var(--ot-transition);
}
.main-nav a:hover {
  color: var(--ot-text);
}
.main-nav a.active {
  color: var(--ot-text);
  border-bottom-color: var(--ot-accent);
}
.account-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-card);
  background: var(--ot-surface);
  box-shadow: var(--ot-shadow-card);
  color: var(--ot-text);
  cursor: pointer;
}
@media (min-width: 600px) {
  .account-chip {
    padding-right: 12px;
  }
}
</style>
