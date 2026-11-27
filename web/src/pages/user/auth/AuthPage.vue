<script setup lang="ts">
// Login + Sign up tabs, Google sign-in (spec 6.1). After login: ?next or the role's home.
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import GoogleSignInButton from '@/components/common/GoogleSignInButton.vue';
import * as authApi from '@/api/auth';
import { ApiError, errorMessage } from '@/api/client';
import { homeFor, useAuthStore } from '@/stores/auth';
import type { CurrentUser } from '@/types';

const props = defineProps<{ tab: 'login' | 'register' }>();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const tab = ref(props.tab);
watch(() => props.tab, (t) => (tab.value = t));
watch(tab, (t) => router.replace({ name: t, query: route.query }));

const name = ref('');
const email = ref('');
const password = ref('');
const show = ref(false);
const busy = ref(false);
const error = ref('');
const unverified = ref(false);
const registered = ref<string | null>(null);
const mailFailed = ref(false);
const banned = computed(() => route.query.banned === '1');

const rules = {
  required: (v: string) => !!v?.trim() || 'Required',
  email: (v: string) => /^\S+@\S+\.\S+$/.test(v) || 'Enter a valid email',
  password: (v: string) => (v?.length ?? 0) >= 8 || 'At least 8 characters',
};

function after(u: CurrentUser) {
  const next = typeof route.query.next === 'string' && route.query.next.startsWith('/') ? route.query.next : null;
  void router.replace(u.mustChangePassword ? '/account/change-password' : next ?? homeFor(u.role));
}

async function submit() {
  error.value = '';
  unverified.value = false;
  busy.value = true;
  try {
    if (tab.value === 'login') after(await auth.login(email.value.trim(), password.value));
    else {
      const r = await authApi.register(name.value.trim(), email.value.trim(), password.value);
      registered.value = r.email;
      mailFailed.value = r.mailSent === false;
      resent.value = false;
    }
  } catch (e) {
    if (e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED') unverified.value = true;
    else if (e instanceof ApiError && e.code === 'BANNED') error.value = 'This account has been suspended. Contact support.';
    else error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function google(credential: string) {
  error.value = '';
  try {
    after(await auth.loginWithGoogle(credential));
  } catch (e) {
    error.value = errorMessage(e);
  }
}
const resent = ref(false);
const resendErr = ref('');
async function resend() {
  resendErr.value = '';
  try {
    await authApi.resendVerification(registered.value ?? email.value.trim());
    resent.value = true;
    mailFailed.value = false;
  } catch (e) {
    resendErr.value = errorMessage(e);
  }
}
</script>

<template>
  <div class="page auth-wrap">
    <div class="auth-col">
      <section v-if="registered" class="panel auth-card center">
        <div class="auth-icon"><v-icon icon="mdi-email-check-outline" size="28" /></div>
        <h1>Check your email</h1>
        <p class="text-body-2 text-muted ma-0" style="line-height: 1.6">We sent a verification link to <strong>{{ registered }}</strong>. Open it to activate your account, then log in. The link works for 24 hours.</p>
        <div v-if="mailFailed" class="callout warning" role="alert">We could not send the email just now. Try sending it again.</div>
        <p class="text-body-2 ma-0">
          <span v-if="resent" role="status">A new link is on its way. Check your spam folder too.</span>
          <template v-else>Didn't get it? <a href="#" @click.prevent="resend">Send the link again</a></template>
        </p>
        <div v-if="resendErr" class="callout danger" role="alert">{{ resendErr }}</div>
        <v-btn variant="outlined" @click="(registered = null), (tab = 'login')">Back to log in</v-btn>
      </section>
      <template v-else>
        <div role="tablist" aria-label="Account" class="seg-tabs">
          <button type="button" role="tab" :aria-selected="tab === 'login'" @click="tab = 'login'">Log in</button>
          <button type="button" role="tab" :aria-selected="tab === 'register'" @click="tab = 'register'">Sign up</button>
        </div>
        <section class="panel auth-card">
          <div>
            <h1 class="mb-1">{{ tab === 'login' ? 'Welcome back' : 'Create your account' }}</h1>
            <p class="text-body-2 text-muted ma-0">{{ tab === 'login' ? 'Log in to continue your courses.' : 'Free to join. Pay only for the paid courses you choose.' }}</p>
          </div>
          <div v-if="banned" class="callout danger">Your account has been suspended.</div>
          <div v-if="error" class="callout danger" role="alert">{{ error }}</div>
          <div v-if="unverified" class="callout warning">
            <span>
              Please verify your email first.
              <a v-if="!resent" href="#" @click.prevent="resend">Send the link again</a>
              <span v-else>Link sent.</span>
            </span>
          </div>
          <v-form class="d-flex flex-column ga-1" @submit.prevent="submit">
            <v-text-field v-if="tab === 'register'" v-model="name" label="Full name" autocomplete="name" :rules="[rules.required]" />
            <v-text-field v-model="email" label="Email" type="email" autocomplete="email" placeholder="you@example.com" :rules="[rules.required, rules.email]" />
            <v-text-field
              v-model="password"
              label="Password"
              :type="show ? 'text' : 'password'"
              :autocomplete="tab === 'login' ? 'current-password' : 'new-password'"
              :rules="tab === 'register' ? [rules.password] : [rules.required]"
              :hint="tab === 'register' ? 'Use 8 or more characters.' : undefined"
              :append-inner-icon="show ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              @click:append-inner="show = !show"
            />
            <div v-if="tab === 'login'" class="text-right mt-n2 mb-2">
              <router-link to="/forgot-password" class="text-body-2 forgot">Forgot password?</router-link>
            </div>
            <v-btn type="submit" color="primary" block min-height="48" :loading="busy">{{ tab === 'login' ? 'Log in' : 'Create account' }}</v-btn>
          </v-form>
          <GoogleSignInButton @credential="google" />
          <p v-if="tab === 'register'" class="agree">
            By creating an account you agree to our <router-link to="/terms">Terms of Service</router-link> and
            <router-link to="/privacy">Privacy Policy</router-link>.
          </p>
          <p v-if="tab === 'register'" class="agree mt-2">
            Want to teach? <router-link to="/register/instructor">Apply as an instructor</router-link>
          </p>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.forgot {
  display: inline-flex;
  align-items: center;
  min-height: var(--ot-control-h);
  color: var(--ot-accent-strong);
  text-decoration: none;
  font-weight: 500;
}
.forgot:hover {
  text-decoration: underline;
}
.agree {
  margin: 16px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ot-muted);
  text-align: center;
}
.agree a {
  color: var(--ot-accent-strong);
}
</style>
