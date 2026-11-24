<script setup lang="ts">
// Instructors (2026-11-23): instructor logins on their own page, apart from Users and Partners.
// Add an instructor here (new login with a temporary password, shown once), or promote a learner who already has an account.
// Click a name to open the instructor's own page (assigned courses, shares, earnings; 2026-11-24).
// Which courses they teach and each course's share are set in the course editor's Instructors tab.
import { onMounted, ref, watch } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import * as api from '@/api/admin/instructors';
import * as users from '@/api/admin/users';
import { ApiError, errorMessage } from '@/api/client';
import type { Paged } from '@/types';
import { date, money } from '@/utils/format';

const q = ref({ q: '', status: '', page: 1 });
const data = ref<Paged<api.InstructorRow> | null>(null);
const err = ref('');
const busy = ref(false);
const add = ref<{ name: string; email: string; exists: boolean } | null>(null);
const addErr = ref('');
const temp = ref<{ email: string; temporaryPassword: string } | null>(null);
const promoted = ref('');
const banTarget = ref<api.InstructorRow | null>(null);
const removeTarget = ref<api.InstructorRow | null>(null);

async function load() {
  data.value = await api.listInstructors(q.value);
}
onMounted(load);
let t: ReturnType<typeof setTimeout> | undefined;
watch(
  q,
  () => {
    clearTimeout(t);
    t = setTimeout(load, 250);
  },
  { deep: true },
);

async function run(fn: () => Promise<unknown>) {
  err.value = '';
  busy.value = true;
  try {
    await fn();
    await load();
    return true;
  } catch (e) {
    err.value = errorMessage(e);
    return false;
  } finally {
    busy.value = false;
  }
}

const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
function openAdd() {
  addErr.value = '';
  add.value = { name: '', email: '', exists: false };
}
async function submitAdd() {
  const a = add.value!;
  if (!a.name.trim() || !validEmail(a.email)) return;
  addErr.value = '';
  busy.value = true;
  try {
    const r = await api.createInstructor({ name: a.name.trim(), email: a.email.trim(), promoteExisting: a.exists || undefined });
    add.value = null;
    if (r.temporaryPassword) temp.value = { email: r.email, temporaryPassword: r.temporaryPassword };
    else promoted.value = r.email;
    await load();
  } catch (e) {
    // The email already belongs to a learner: ask before turning that account into an instructor.
    if (e instanceof ApiError && e.code === 'ACCOUNT_EXISTS') a.exists = true;
    else addErr.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function reset(i: api.InstructorRow) {
  await run(async () => (temp.value = await api.resetInstructorPassword(i.id)));
}
async function copy() {
  await navigator.clipboard.writeText(temp.value!.temporaryPassword).catch(() => undefined);
}
const hasOutstanding = (i: api.InstructorRow) => i.outstanding.some((o) => o.amountMinor > 0);
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Instructors" subtitle="Instructor logins. Open an instructor to see their courses, shares and earnings. Assign courses and set shares in the course editor's Instructors tab.">
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openAdd">Add instructor</v-btn>
    </AdminPageHeader>
    <div class="filters">
      <div class="grow2"><label for="i-q" class="sr-only">Search instructors</label><input id="i-q" v-model="q.q" type="search" class="ot-input" placeholder="Search name or email" /></div>
      <div class="grow1">
        <label for="i-s" class="sr-only">Status</label>
        <select id="i-s" v-model="q.status" class="ot-select">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="BANNED">Banned</option>
        </select>
      </div>
    </div>
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <div v-if="promoted" class="callout success" role="status">
      <span><strong>{{ promoted }}</strong> is now an instructor. They log in with their own password.</span>
      <v-btn size="small" variant="text" icon="mdi-close" aria-label="Dismiss" @click="promoted = ''" />
    </div>
    <v-skeleton-loader v-if="!data" type="table" color="surface" />
    <div v-else-if="!data.items.length && !q.q && !q.status" class="panel pa-10 text-center text-body-2 text-muted">
      No instructors yet. Add one to give them a login.
    </div>
    <div v-else class="table-scroll">
      <table class="data-table" style="min-width: 760px">
        <caption class="sr-only">Instructors</caption>
        <thead>
          <tr>
            <th scope="col">Instructor</th>
            <th scope="col">Unpaid</th>
            <th scope="col">Status</th>
            <th scope="col">Added</th>
            <th scope="col" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in data.items" :key="i.id">
            <td>
              <router-link :to="`/admin/instructors/${i.id}`" class="font-weight-medium">{{ i.name }}</router-link>
              <div class="text-caption text-muted">{{ i.email }}<span v-if="i.mustChangePassword"> · temporary password</span></div>
            </td>
            <td class="text-no-wrap">
              <template v-if="hasOutstanding(i)">
                <div v-for="o in i.outstanding" :key="o.currency">{{ money(o.amountMinor, o.currency) }}</div>
              </template>
              <span v-else class="text-caption text-muted">None</span>
            </td>
            <td><StatusPill :label="i.status === 'BANNED' ? 'Banned' : 'Active'" :tone="i.status === 'BANNED' ? 'danger' : 'success'" /></td>
            <td class="text-no-wrap text-muted">{{ date(i.createdAt) }}</td>
            <td class="text-right text-no-wrap">
              <button type="button" class="row-btn" :disabled="busy" @click="reset(i)">Reset password</button>
              <button v-if="i.status === 'ACTIVE'" type="button" class="row-btn" style="color: var(--ot-danger)" @click="banTarget = i">Ban</button>
              <button v-else type="button" class="row-btn" :disabled="busy" @click="run(() => users.unban(i.id))">Unban</button>
              <button
                type="button"
                class="row-link danger"
                :disabled="!!i.courses.length"
                :title="i.courses.length ? 'Remove them from their courses first' : undefined"
                @click="removeTarget = i"
              >
                Remove role
              </button>
            </td>
          </tr>
          <tr v-if="!data.items.length"><td colspan="5" class="text-center text-muted">No instructors match.</td></tr>
        </tbody>
      </table>
    </div>
    <v-pagination v-if="data && data.pages > 1" v-model="q.page" :length="data.pages" density="comfortable" />

    <v-dialog :model-value="!!add" max-width="480" @update:model-value="add = null">
      <v-card v-if="add" color="surface" class="pa-2">
        <v-card-title>{{ add.exists ? 'This email already has an account' : 'Add instructor' }}</v-card-title>
        <v-card-text>
          <template v-if="!add.exists">
            <p class="text-body-2 text-muted mb-4">They get a login with a temporary password and must change it on first login. Then assign them to courses in the course editor.</p>
            <v-text-field v-model="add.name" label="Name" class="mb-2" autofocus />
            <v-text-field v-model="add.email" label="Email" type="email" :error-messages="add.email && !validEmail(add.email) ? 'Enter a valid email.' : undefined" />
          </template>
          <p v-else class="text-body-2 mb-0">
            <strong>{{ add.email }}</strong> is a learner on this site. Make this account an instructor? They keep their password and their courses as a learner.
          </p>
          <div v-if="addErr" class="callout danger mt-3" role="alert">{{ addErr }}</div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="add = null">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="busy" :disabled="!add.name.trim() || !validEmail(add.email)" @click="submitAdd">
            {{ add.exists ? 'Make instructor' : 'Create' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog :model-value="!!temp" max-width="480" persistent>
      <v-card v-if="temp" color="surface" class="pa-2">
        <v-card-title>Temporary password</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-3">Give this to {{ temp.email }} through a safe channel. It is shown only now.</p>
          <div class="d-flex align-center ga-2 pa-3 rounded" style="background: var(--ot-deep); border: 1px solid var(--ot-border)"><span class="mono flex-grow-1">{{ temp.temporaryPassword }}</span><v-btn size="small" variant="text" icon="mdi-content-copy" aria-label="Copy" @click="copy" /></div>
          <p class="text-caption text-muted mt-3 mb-0">The instructor can also use “Forgot password” on the login page.</p>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn color="primary" variant="flat" @click="temp = null">Done</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <ConfirmDialog :model-value="!!banTarget" title="Ban this instructor?" danger confirm-label="Ban" :loading="busy" @update:model-value="banTarget = null" @confirm="run(() => users.ban(banTarget!.id)).then(() => (banTarget = null))">
      <strong>{{ banTarget?.name }}</strong> is signed out and cannot log in until unbanned. Their courses and earnings are kept.
    </ConfirmDialog>
    <ConfirmDialog :model-value="!!removeTarget" title="Remove instructor role?" confirm-label="Remove role" :loading="busy" @update:model-value="removeTarget = null" @confirm="run(() => api.removeInstructor(removeTarget!.id)).then(() => (removeTarget = null))">
      <strong>{{ removeTarget?.name }}</strong> becomes a learner account and moves to Users. Past earnings stay in the revenue reports.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.row-link:disabled {
  color: var(--ot-faint);
  cursor: not-allowed;
}
</style>
