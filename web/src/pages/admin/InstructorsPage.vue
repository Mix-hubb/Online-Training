<script setup lang="ts">
// Instructors (2026-11-23): instructor logins on their own page, apart from Users and Partners.
// 2026-11-27: instructors sign up themselves (/register/instructor) with their documents. New applications wait
// under "Waiting for approval"; open one to check the documents and approve or turn it down. There is no
// "Add instructor" any more. Each approved instructor's revenue share (one percent for all of the courses they
// own) is set on their page.
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import * as api from '@/api/admin/instructors';
import * as users from '@/api/admin/users';
import { errorMessage } from '@/api/client';
import type { InstructorStatus, Paged } from '@/types';
import { date, money, percentBp } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const initial = (['PENDING', 'APPROVED', 'REJECTED'] as const).find((s) => s === route.query.approval) ?? 'APPROVED';
const q = ref({ q: '', status: '', approval: initial as InstructorStatus, page: 1 });
const data = ref<(Paged<api.InstructorRow> & { counts: Partial<Record<InstructorStatus, number>> }) | null>(null);
const err = ref('');
const busy = ref(false);
const temp = ref<{ email: string; temporaryPassword: string } | null>(null);
const banTarget = ref<api.InstructorRow | null>(null);
const removeTarget = ref<api.InstructorRow | null>(null);

async function load() {
  data.value = await api.listInstructors(q.value);
}
onMounted(load);
let t: ReturnType<typeof setTimeout> | undefined;
watch(
  () => [q.value.q, q.value.status],
  () => {
    q.value.page = 1;
    clearTimeout(t);
    t = setTimeout(load, 250);
  },
);
watch(
  () => [q.value.approval, q.value.page],
  () => {
    void router.replace({ query: { approval: q.value.approval } });
    void load();
  },
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
async function reset(i: api.InstructorRow) {
  await run(async () => (temp.value = await api.resetInstructorPassword(i.id)));
}
async function copy() {
  await navigator.clipboard.writeText(temp.value!.temporaryPassword).catch(() => undefined);
}
const hasOutstanding = (i: api.InstructorRow) => i.outstanding.some((o) => o.amountMinor > 0);
const tabs = computed(() => [
  { v: 'APPROVED' as const, label: 'Approved', n: data.value?.counts.APPROVED ?? 0 },
  { v: 'PENDING' as const, label: 'Waiting for approval', n: data.value?.counts.PENDING ?? 0 },
  { v: 'REJECTED' as const, label: 'Not approved', n: data.value?.counts.REJECTED ?? 0 },
]);
const approved = computed(() => q.value.approval === 'APPROVED');
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader
      title="Instructors"
      subtitle="Instructors apply with their documents. Approve new applications here, then set each instructor's revenue share on their page."
    />
    <div role="tablist" aria-label="Instructor applications" class="ul-tabs">
      <button v-for="tb in tabs" :key="tb.v" type="button" role="tab" :aria-selected="q.approval === tb.v" @click="(q.approval = tb.v), (q.page = 1)">
        {{ tb.label }}
        <span v-if="tb.n" class="count" :class="{ hot: tb.v === 'PENDING' }">{{ tb.n }}</span>
      </button>
    </div>
    <div class="filters">
      <div class="grow2"><label for="i-q" class="sr-only">Search instructors</label><input id="i-q" v-model="q.q" type="search" class="ot-input" placeholder="Search name or email" /></div>
      <div v-if="approved" class="grow1">
        <label for="i-s" class="sr-only">Status</label>
        <select id="i-s" v-model="q.status" class="ot-select">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="BANNED">Banned</option>
        </select>
      </div>
    </div>
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <v-skeleton-loader v-if="!data" type="table" color="surface" />
    <div v-else-if="!data.items.length && !q.q && !q.status" class="panel pa-10 text-center text-body-2 text-muted">
      {{
        q.approval === 'PENDING'
          ? 'No applications are waiting. New instructors apply from the sign-up page.'
          : q.approval === 'REJECTED'
            ? 'No turned-down applications.'
            : 'No approved instructors yet.'
      }}
    </div>

    <div v-else-if="!approved" class="table-scroll">
      <table class="data-table" style="min-width: 760px">
        <caption class="sr-only">Instructor applications</caption>
        <thead>
          <tr>
            <th scope="col">Applicant</th>
            <th scope="col">Headline</th>
            <th scope="col">Documents</th>
            <th scope="col">Sent</th>
            <th scope="col" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in data.items" :key="i.id">
            <td>
              <router-link :to="`/admin/instructors/${i.id}`" class="font-weight-medium">{{ i.name }}</router-link>
              <div class="text-caption text-muted">{{ i.email }}</div>
            </td>
            <td style="max-width: 320px">
              <span class="d-block text-truncate">{{ i.headline ?? '—' }}</span>
              <span v-if="i.rejectReason" class="d-block text-caption text-muted text-truncate">Reason: {{ i.rejectReason }}</span>
            </td>
            <td>{{ i.documents }}</td>
            <td class="text-no-wrap text-muted">{{ i.submittedAt ? date(i.submittedAt) : '—' }}</td>
            <td class="text-right text-no-wrap">
              <router-link :to="`/admin/instructors/${i.id}`" class="row-btn">Review</router-link>
            </td>
          </tr>
          <tr v-if="!data.items.length"><td colspan="5" class="text-center text-muted">No applications match.</td></tr>
        </tbody>
      </table>
    </div>

    <div v-else class="table-scroll">
      <table class="data-table" style="min-width: 820px">
        <caption class="sr-only">Instructors</caption>
        <thead>
          <tr>
            <th scope="col">Instructor</th>
            <th scope="col">Revenue share</th>
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
              <router-link :to="`/admin/instructors/${i.id}#share`" :class="i.sharePercentBp ? '' : 'text-warning'">
                {{ i.sharePercentBp ? percentBp(i.sharePercentBp) : 'Not set' }}
              </router-link>
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
                :title="i.courses.length ? 'They still teach courses' : undefined"
                @click="removeTarget = i"
              >
                Remove role
              </button>
            </td>
          </tr>
          <tr v-if="!data.items.length"><td colspan="6" class="text-center text-muted">No instructors match.</td></tr>
        </tbody>
      </table>
    </div>
    <v-pagination v-if="data && data.pages > 1" v-model="q.page" :length="data.pages" density="comfortable" />

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
.count {
  margin-left: 6px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: var(--ot-chip-bg, var(--ot-border));
  color: var(--ot-text);
}
.count.hot {
  background: var(--ot-warning-bg);
  color: var(--ot-warning);
}
</style>
