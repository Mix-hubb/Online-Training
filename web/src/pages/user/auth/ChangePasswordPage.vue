<script setup lang="ts">
// Change password. Forced after an admin-created account or an admin reset (mustChangePassword).
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthMessageCard from '@/components/auth/AuthMessageCard.vue';
import * as authApi from '@/api/auth';
import { errorMessage } from '@/api/client';
import { homeFor, useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const forced = computed(() => !!auth.user?.mustChangePassword);
const cur = ref('');
const pw = ref('');
const pw2 = ref('');
const busy = ref(false);
const err = ref('');
const done = ref(false);

async function submit() {
  err.value = '';
  if (pw.value.length < 8) return void (err.value = 'Use at least 8 characters.');
  if (pw.value !== pw2.value) return void (err.value = 'The passwords do not match.');
  busy.value = true;
  try {
    const r = await authApi.changePassword(auth.user?.hasPassword ? cur.value : undefined, pw.value);
    auth.setUser(r.user);
    done.value = true;
    setTimeout(() => router.replace(homeFor(r.user.role)), 1200);
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function logout() {
  await auth.logout();
  await router.replace('/login');
}
</script>

<template>
  <AuthMessageCard v-if="done" title="Password changed" icon="mdi-check-circle-outline" tone="success">
    <p class="text-body-2 text-muted">Taking you back…</p>
  </AuthMessageCard>
  <AuthMessageCard v-else :title="forced ? 'Set your own password' : 'Change password'" icon="mdi-lock-outline">
    <p v-if="forced" class="text-body-2 text-muted mb-4">You signed in with a temporary password. Choose a new one to continue.</p>
    <v-alert v-if="err" type="error" variant="tonal" density="compact" class="mb-4">{{ err }}</v-alert>
    <v-form @submit.prevent="submit">
      <v-text-field v-if="auth.user?.hasPassword" v-model="cur" :label="forced ? 'Temporary password' : 'Current password'" type="password" autocomplete="current-password" class="mb-2" />
      <v-text-field v-model="pw" label="New password" type="password" autocomplete="new-password" hint="At least 8 characters" class="mb-2" />
      <v-text-field v-model="pw2" label="Repeat new password" type="password" autocomplete="new-password" />
      <v-btn type="submit" color="primary" block size="large" :loading="busy" class="mt-2">Save password</v-btn>
    </v-form>
    <div v-if="forced" class="text-center mt-4"><a href="#" class="text-body-2" @click.prevent="logout">Log out</a></div>
  </AuthMessageCard>
</template>
