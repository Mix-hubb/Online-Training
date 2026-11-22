<script setup lang="ts">
// /verify-email?token=... -> verifies, logs in, then goes home.
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AuthMessageCard from '@/components/auth/AuthMessageCard.vue';
import * as authApi from '@/api/auth';
import { homeFor, useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const state = ref<'checking' | 'ok' | 'failed'>('checking');

onMounted(async () => {
  const token = String(route.query.token ?? '');
  if (!token) return void (state.value = 'failed');
  try {
    const r = await authApi.verifyEmail(token);
    auth.setUser(r.user);
    state.value = 'ok';
    setTimeout(() => router.replace(homeFor(r.user.role)), 1500);
  } catch {
    state.value = 'failed';
  }
});
</script>

<template>
  <AuthMessageCard v-if="state === 'checking'" title="Verifying your email…" icon="mdi-email-sync-outline">
    <v-progress-linear indeterminate color="primary" class="mt-4" />
  </AuthMessageCard>
  <AuthMessageCard v-else-if="state === 'ok'" title="Email verified" icon="mdi-check-circle-outline" tone="success">
    <p class="text-body-2 text-muted">Your account is ready. Taking you to the courses…</p>
  </AuthMessageCard>
  <AuthMessageCard v-else title="This link has expired or is invalid" icon="mdi-link-off" tone="warning">
    <p class="text-body-2 text-muted mb-6">Log in with your email and password and we will offer to send a new link.</p>
    <v-btn color="primary" block to="/login">Go to log in</v-btn>
  </AuthMessageCard>
</template>
