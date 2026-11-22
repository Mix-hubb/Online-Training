<script setup lang="ts">
// Request a reset link. Always shows the same message (does not reveal whether the email exists).
import { ref } from 'vue';
import AuthMessageCard from '@/components/auth/AuthMessageCard.vue';
import * as authApi from '@/api/auth';

const email = ref('');
const busy = ref(false);
const sent = ref(false);
async function submit() {
  if (!/^\S+@\S+\.\S+$/.test(email.value)) return;
  busy.value = true;
  await authApi.forgotPassword(email.value.trim()).catch(() => undefined);
  busy.value = false;
  sent.value = true;
}
</script>

<template>
  <AuthMessageCard v-if="sent" title="Check your email" icon="mdi-email-fast-outline">
    <p class="text-body-2 text-muted mb-4">If an account exists for <strong>{{ email }}</strong>, we sent a link to reset the password. The link works for 1 hour.</p>
    <p class="text-body-2 text-muted mb-6">No email? Check the spam folder, or contact support and an admin can reset it for you.</p>
    <v-btn block variant="outlined" to="/login">Back to log in</v-btn>
  </AuthMessageCard>
  <AuthMessageCard v-else title="Forgot your password?" icon="mdi-lock-question">
    <p class="text-body-2 text-muted mb-6">Enter your email and we will send you a link to set a new one.</p>
    <v-form @submit.prevent="submit">
      <v-text-field v-model="email" label="Email" type="email" autocomplete="email" :rules="[(v: string) => /^\S+@\S+\.\S+$/.test(v) || 'Enter a valid email']" />
      <v-btn type="submit" color="primary" block size="large" :loading="busy" class="mt-2">Send reset link</v-btn>
    </v-form>
    <div class="text-center mt-4"><router-link to="/login" class="text-body-2">Back to log in</router-link></div>
  </AuthMessageCard>
</template>
