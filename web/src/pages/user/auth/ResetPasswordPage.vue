<script setup lang="ts">
// /reset-password?token=... -> set a new password.
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import AuthMessageCard from '@/components/auth/AuthMessageCard.vue';
import * as authApi from '@/api/auth';

const route = useRoute();
const token = String(route.query.token ?? '');
const pw = ref('');
const pw2 = ref('');
const busy = ref(false);
const state = ref<'form' | 'done' | 'invalid'>(token ? 'form' : 'invalid');
const err = ref('');
async function submit() {
  err.value = '';
  if (pw.value.length < 8) return void (err.value = 'Use at least 8 characters.');
  if (pw.value !== pw2.value) return void (err.value = 'The passwords do not match.');
  busy.value = true;
  try {
    await authApi.resetPassword(token, pw.value);
    state.value = 'done';
  } catch {
    state.value = 'invalid';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AuthMessageCard v-if="state === 'done'" title="Password updated" icon="mdi-check-circle-outline" tone="success">
    <p class="text-body-2 text-muted mb-6">You can now log in with your new password.</p>
    <v-btn color="primary" block to="/login">Log in</v-btn>
  </AuthMessageCard>
  <AuthMessageCard v-else-if="state === 'invalid'" title="This link has expired or is invalid" icon="mdi-link-off" tone="warning">
    <p class="text-body-2 text-muted mb-6">Reset links work once and for 1 hour. Ask for a new one.</p>
    <v-btn color="primary" block to="/forgot-password">Send a new link</v-btn>
  </AuthMessageCard>
  <AuthMessageCard v-else title="Set a new password" icon="mdi-lock-reset">
    <v-alert v-if="err" type="error" variant="tonal" density="compact" class="mb-4">{{ err }}</v-alert>
    <v-form @submit.prevent="submit">
      <v-text-field v-model="pw" label="New password" type="password" autocomplete="new-password" hint="At least 8 characters" class="mb-2" />
      <v-text-field v-model="pw2" label="Repeat new password" type="password" autocomplete="new-password" />
      <v-btn type="submit" color="primary" block size="large" :loading="busy" class="mt-2">Save password</v-btn>
    </v-form>
  </AuthMessageCard>
</template>
