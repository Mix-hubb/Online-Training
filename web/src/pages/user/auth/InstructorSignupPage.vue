<script setup lang="ts">
// Instructor sign-up (2026-11-27). Step 1: account and profile. Step 2: documents that show you can teach
// (certificates, degree, work letters). Then verify the email; an admin reviews the application before the
// instructor tools open. The instructor picks which documents show on the public profile.
import { computed, ref, watch } from 'vue';
import ProfileFieldsForm from '@/components/instructor/ProfileFieldsForm.vue';
import * as api from '@/api/instructors';
import * as authApi from '@/api/auth';
import { errorMessage, fileToBase64 } from '@/api/client';

interface Picked {
  key: number;
  file: File;
  title: string;
  isPublic: boolean;
}

const step = ref<1 | 2>(1);
const name = ref('');
const email = ref('');
const password = ref('');
const show = ref(false);
const profile = ref<api.ProfileFields>({ phone: '', headline: '', bio: '', expertise: [] });
const docs = ref<Picked[]>([]);
const input = ref<HTMLInputElement | null>(null);
const busy = ref(false);
const error = ref('');
const done = ref<{ email: string; mailSent: boolean } | null>(null);
const resent = ref(false);
let seq = 0;

const rules = {
  required: (v: string) => !!v?.trim() || 'Required',
  email: (v: string) => /^\S+@\S+\.\S+$/.test(v) || 'Enter a valid email',
  password: (v: string) => (v?.length ?? 0) >= 8 || 'At least 8 characters',
};
const totalMb = computed(() => docs.value.reduce((s, d) => s + d.file.size, 0) / 1024 / 1024);
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

async function next(e: Event & { valid?: Promise<{ valid: boolean }> }) {
  error.value = '';
  const ok = e.valid ? (await e.valid).valid : true;
  if (ok) step.value = 2;
}
function pick(e: Event) {
  error.value = '';
  const files = Array.from((e.target as HTMLInputElement).files ?? []);
  (e.target as HTMLInputElement).value = '';
  for (const f of files) {
    if (docs.value.length >= api.MAX_DOCS) {
      error.value = `Up to ${api.MAX_DOCS} documents.`;
      break;
    }
    if (!ACCEPT.split(',').includes(f.type)) {
      error.value = `${f.name}: use a PDF, JPG, PNG or WebP file.`;
      continue;
    }
    if (f.size > api.MAX_DOC_MB * 1024 * 1024) {
      error.value = `${f.name} is larger than ${api.MAX_DOC_MB} MB.`;
      continue;
    }
    docs.value.push({ key: ++seq, file: f, title: f.name.replace(/\.[^.]+$/, '').slice(0, 120), isPublic: false });
  }
}
async function submit() {
  error.value = '';
  if (!docs.value.length) return void (error.value = 'Add at least one document.');
  if (docs.value.some((d) => !d.title.trim())) return void (error.value = 'Give every document a name.');
  if (totalMb.value > api.MAX_SIGNUP_MB) return void (error.value = `The documents add up to more than ${api.MAX_SIGNUP_MB} MB. Add fewer now and the rest after approval.`);
  busy.value = true;
  try {
    const documents = await Promise.all(
      docs.value.map(async (d) => ({ title: d.title.trim(), isPublic: d.isPublic, file: { name: d.file.name, dataBase64: await fileToBase64(d.file) } })),
    );
    const r = await api.register({
      name: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
      ...profile.value,
      phone: profile.value.phone.trim(),
      headline: profile.value.headline.trim(),
      bio: profile.value.bio.trim(),
      documents,
    });
    done.value = { email: r.email, mailSent: r.mailSent };
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function resend() {
  try {
    await authApi.resendVerification(done.value!.email);
    resent.value = true;
  } catch (e) {
    error.value = errorMessage(e);
  }
}
const mb = (b: number) => (b < 100 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
// Each step and the result start at the top of the page.
watch([step, done], () => window.scrollTo({ top: 0 }));
</script>

<template>
  <div class="page auth-wrap">
    <div class="auth-col wide">
      <section v-if="done" class="panel auth-card center">
        <div class="auth-icon"><v-icon icon="mdi-email-check-outline" size="28" /></div>
        <h1>Application sent</h1>
        <p class="text-body-2 text-muted ma-0" style="line-height: 1.6">
          We sent a verification link to <strong>{{ done.email }}</strong>. Open it, then log in to follow your application.
          An admin checks your documents; you can make courses once you are approved.
        </p>
        <div v-if="!done.mailSent && !resent" class="callout warning" role="alert">We could not send the email just now. Try sending it again.</div>
        <p class="text-body-2 ma-0">
          <span v-if="resent" role="status">A new link is on its way. Check your spam folder too.</span>
          <template v-else>Didn't get it? <a href="#" @click.prevent="resend">Send the link again</a></template>
        </p>
        <div v-if="error" class="callout danger" role="alert">{{ error }}</div>
        <v-btn variant="outlined" to="/login">Go to log in</v-btn>
      </section>

      <section v-else class="panel auth-card">
        <div>
          <p class="eyebrow ma-0">Step {{ step }} of 2</p>
          <h1 class="mb-1">{{ step === 1 ? 'Apply to teach' : 'Your documents' }}</h1>
          <p class="text-body-2 text-muted ma-0">
            {{
              step === 1
                ? 'Tell us about yourself. An admin reviews every application before you can publish courses.'
                : 'Upload certificates, degrees or work letters that show you can teach this subject. Choose which ones show on your public profile.'
            }}
          </p>
        </div>
        <div v-if="error" class="callout danger" role="alert">{{ error }}</div>

        <v-form v-if="step === 1" class="d-flex flex-column ga-1" @submit.prevent="next">
          <v-text-field v-model="name" label="Full name" autocomplete="name" :rules="[rules.required]" />
          <v-text-field v-model="email" label="Email" type="email" autocomplete="email" :rules="[rules.required, rules.email]" />
          <v-text-field
            v-model="password"
            label="Password"
            :type="show ? 'text' : 'password'"
            autocomplete="new-password"
            :rules="[rules.password]"
            hint="Use 8 or more characters."
            :append-inner-icon="show ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            @click:append-inner="show = !show"
          />
          <ProfileFieldsForm v-model="profile" />
          <v-btn type="submit" color="primary" block min-height="48" class="mt-2">Next: documents</v-btn>
        </v-form>

        <template v-else>
          <ul v-if="docs.length" class="docs">
            <li v-for="d in docs" :key="d.key">
              <v-icon :icon="d.file.type === 'application/pdf' ? 'mdi-file-pdf-box' : 'mdi-file-image-outline'" size="24" class="text-muted" />
              <div class="flex-grow-1 d-flex flex-column ga-1" style="min-width: 0">
                <label :for="`doc-${d.key}`" class="sr-only">Document name</label>
                <input :id="`doc-${d.key}`" v-model="d.title" class="ot-input" maxlength="120" placeholder="Document name" />
                <span class="text-caption text-muted text-truncate">{{ d.file.name }} · {{ mb(d.file.size) }}</span>
              </div>
              <label class="pub">
                <input v-model="d.isPublic" type="checkbox" />
                <span>Show on profile</span>
              </label>
              <button type="button" class="row-link danger" :aria-label="`Remove ${d.title}`" @click="docs = docs.filter((x) => x.key !== d.key)">Remove</button>
            </li>
          </ul>
          <div class="drop">
            <input ref="input" type="file" :accept="ACCEPT" multiple class="sr-only" @change="pick" />
            <v-btn variant="outlined" prepend-icon="mdi-upload" :disabled="docs.length >= api.MAX_DOCS" @click="input?.click()">Add documents</v-btn>
            <span class="text-caption text-muted">PDF, JPG, PNG or WebP, up to {{ api.MAX_DOC_MB }} MB each, {{ api.MAX_DOCS }} at most.</span>
          </div>
          <div class="d-flex ga-2">
            <v-btn variant="outlined" min-height="48" @click="step = 1">Back</v-btn>
            <v-btn color="primary" class="flex-grow-1" min-height="48" :loading="busy" :disabled="!docs.length" @click="submit">Send application</v-btn>
          </div>
          <p class="agree">
            By applying you agree to our <router-link to="/terms">Terms of Service</router-link> and <router-link to="/privacy">Privacy Policy</router-link>.
          </p>
        </template>
        <p v-if="step === 1" class="agree">Already applied? <router-link to="/login">Log in</router-link></p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.auth-col.wide {
  max-width: 560px;
}
.eyebrow {
  font-size: 12px;
  font-weight: 600;
  color: var(--ot-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.docs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.docs li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--ot-border);
}
.docs li:last-child {
  border-bottom: 1px solid var(--ot-border);
}
.pub {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  min-height: var(--ot-control-h);
  cursor: pointer;
}
.drop {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.agree {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ot-muted);
  text-align: center;
}
.agree a {
  color: var(--ot-accent-strong);
}
</style>
