<script setup lang="ts">
// Header: logo, Courses, My learning, Messages, bell, account menu; logged out: Log in + Sign up.
// The way to the admin / instructor / partner area is in the account menu only (2026-11-24).
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import AccountMenu from './AccountMenu.vue';
import BrandMark from './BrandMark.vue';
import NotificationBell from './NotificationBell.vue';
import { useAuthStore } from '@/stores/auth';
import { smoothScrollTo } from '@/utils/smoothScroll';

const auth = useAuthStore();
const { mdAndUp } = useDisplay();
const drawer = ref(false);
const route = useRoute();
const router = useRouter();

// "Instructors" glides down to the cards on the home page, like "Browse courses" does.
function toInstructors() {
  drawer.value = false;
  // From another page, the home page scrolls there itself once its content has loaded.
  if (route.path !== '/') return void router.push({ path: '/', hash: '#instructors' });
  const el = document.getElementById('instructors');
  if (!el) return;
  el.focus({ preventScroll: true });
  void smoothScrollTo(el.getBoundingClientRect().top + window.scrollY - 88);
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
          <a href="/#instructors" @click.prevent="toInstructors">Instructors</a>
          <router-link v-if="auth.user && auth.user.role !== 'PARTNER'" to="/profile" active-class="active">My learning</router-link>
          <router-link v-if="auth.user && auth.user.role !== 'PARTNER'" to="/messages" active-class="active">Messages</router-link>
        </nav>
      </template>
      <v-spacer />
      <template v-if="auth.user">
        <div class="d-flex align-center ga-2">
          <NotificationBell framed />
          <AccountMenu place="site" />
        </div>
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
      <v-list-item href="/#instructors" title="Instructors" prepend-icon="mdi-account-tie-outline" @click.prevent="toInstructors" />
      <template v-if="auth.user && auth.user.role !== 'PARTNER'">
        <v-list-item to="/profile" title="My learning" prepend-icon="mdi-school-outline" />
        <v-list-item to="/messages" title="Messages" prepend-icon="mdi-message-outline" />
      </template>
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
</style>
