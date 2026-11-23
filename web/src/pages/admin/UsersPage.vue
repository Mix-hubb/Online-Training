<script setup lang="ts">
// Users: learners and admins only (instructors and partners have their own pages). Search/filter, detail drawer, ban/unban.
import { onMounted, ref, watch } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import * as api from '@/api/admin/users';
import { errorMessage } from '@/api/client';
import type { Paged } from '@/types';
import { date, learningStatusLabel, money } from '@/utils/format';

const q = ref({ q: '', role: '', status: '', page: 1 });
const data = ref<Paged<api.UserRow> | null>(null);
const detail = ref<Awaited<ReturnType<typeof api.detail>> | null>(null);
const drawer = ref(false);
const confirmBan = ref(false);
const banTarget = ref<{ id: string; name: string } | null>(null);
function askBan(u: { id: string; name: string }) {
  banTarget.value = u;
  confirmBan.value = true;
}
const err = ref('');
async function load() {
  data.value = await api.list({ ...q.value, roles: q.value.role ? undefined : 'USER,ADMIN' });
}
onMounted(load);
let t: ReturnType<typeof setTimeout> | undefined;
watch(q, () => {
  clearTimeout(t);
  t = setTimeout(load, 250);
}, { deep: true });
async function open(u: api.UserRow) {
  drawer.value = true;
  detail.value = null;
  detail.value = await api.detail(u.id);
}
async function act(fn: () => Promise<unknown>) {
  err.value = '';
  try {
    await fn();
    await Promise.all([load(), drawer.value && detail.value && open(detail.value.user)]);
  } catch (e) {
    err.value = errorMessage(e);
  }
}
const roleLabel: Record<string, string> = { USER: 'Learner', ADMIN: 'Admin' };
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Users" subtitle="Learners and admins: see who joined and turn accounts off. Instructors and partners are on their own pages." />
    <div class="filters">
      <div class="grow2"><label for="u-q" class="sr-only">Search users</label><input id="u-q" v-model="q.q" type="search" class="ot-input" placeholder="Search name or email" /></div>
      <div class="grow1">
        <label for="u-r" class="sr-only">Role</label>
        <select id="u-r" v-model="q.role" class="ot-select">
          <option value="">All roles</option>
          <option v-for="(label, v) in roleLabel" :key="v" :value="v">{{ label }}</option>
        </select>
      </div>
      <div class="grow1">
        <label for="u-s" class="sr-only">Status</label>
        <select id="u-s" v-model="q.status" class="ot-select">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="BANNED">Banned</option>
        </select>
      </div>
    </div>
    <div v-if="err && !drawer" class="callout danger" role="alert">{{ err }}</div>
    <v-skeleton-loader v-if="!data" type="table" color="surface" />
    <div v-else class="table-scroll">
      <table class="data-table" style="min-width: 820px">
        <caption class="sr-only">All users</caption>
        <thead>
          <tr>
            <th scope="col">User</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col">Courses</th>
            <th scope="col">Joined</th>
            <th scope="col" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in data.items" :key="u.id">
            <td>
              <div class="font-weight-medium">{{ u.name }}</div>
              <div class="text-caption text-muted">{{ u.email }}<span v-if="!u.emailVerifiedAt"> · not verified</span></div>
            </td>
            <td class="text-2">{{ roleLabel[u.role] }}</td>
            <td>
              <StatusPill :label="u.status === 'BANNED' ? 'Banned' : u.emailVerifiedAt ? 'Active' : 'Not verified'" :tone="u.status === 'BANNED' ? 'danger' : u.emailVerifiedAt ? 'success' : 'warning'" />
            </td>
            <td>{{ u._count?.enrollments ?? 0 }}</td>
            <td class="text-no-wrap text-muted">{{ date(u.createdAt) }}</td>
            <td class="text-right text-no-wrap">
              <button type="button" class="row-link" @click="open(u)">View</button>
              <template v-if="u.role !== 'ADMIN'">
                <button v-if="u.status === 'ACTIVE'" type="button" class="row-btn" style="color: var(--ot-danger)" @click="askBan(u)">Ban</button>
                <button v-else type="button" class="row-btn" @click="act(() => api.unban(u.id))">Unban</button>
              </template>
            </td>
          </tr>
          <tr v-if="!data.items.length"><td colspan="6" class="text-center text-muted">No users match.</td></tr>
        </tbody>
      </table>
    </div>
    <v-pagination v-if="data && data.pages > 1" v-model="q.page" :length="data.pages" density="comfortable" />

    <v-navigation-drawer v-model="drawer" location="right" temporary width="480" color="surface">
      <div v-if="!detail" class="pa-6"><v-progress-circular indeterminate color="primary" /></div>
      <div v-else class="pa-6 d-flex flex-column ga-5">
        <div class="d-flex align-start ga-2">
          <div class="flex-grow-1" style="min-width: 0">
            <h2 class="dtitle">{{ detail.user.name }}</h2>
            <div class="text-body-2 text-muted mt-1">{{ detail.user.email }} · {{ roleLabel[detail.user.role] }}</div>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" aria-label="Close" @click="drawer = false" />
        </div>
        <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
        <div class="d-flex flex-wrap ga-2">
          <template v-if="detail.user.role !== 'ADMIN'">
            <v-btn v-if="detail.user.status === 'ACTIVE'" size="small" variant="outlined" color="error" @click="askBan(detail.user)">Ban</v-btn>
            <v-btn v-else size="small" variant="outlined" @click="act(() => api.unban(detail!.user.id))">Unban</v-btn>
          </template>
        </div>
        <section class="d-flex flex-column ga-2">
          <h3 class="dsub">Courses</h3>
          <div v-if="!detail.courses.length" class="text-body-2 text-muted">None.</div>
          <div v-for="c in detail.courses" :key="c.enrollmentId" class="ditem">
            <span class="font-weight-medium">{{ c.course.title }}</span>
            <span class="text-caption text-muted">{{ learningStatusLabel[c.status] }} · {{ c.percent }}%</span>
          </div>
        </section>
        <section class="d-flex flex-column ga-2">
          <h3 class="dsub">Orders</h3>
          <div v-if="!detail.orders.length" class="text-body-2 text-muted">None.</div>
          <div v-for="o in detail.orders" :key="o.id" class="ditem">
            <span class="font-weight-medium">{{ o.course.title }}</span>
            <span class="text-caption text-muted">{{ date(o.createdAt) }} · {{ money(o.amountMinor, o.currency) }} · {{ o.status.toLowerCase() }}</span>
          </div>
        </section>
      </div>
    </v-navigation-drawer>
    <ConfirmDialog v-model="confirmBan" title="Ban this user?" danger confirm-label="Ban" @confirm="(confirmBan = false), banTarget && act(() => api.ban(banTarget!.id))">
      <strong>{{ banTarget?.name }}</strong> is signed out and cannot log in until unbanned. Their data is kept.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.dtitle {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
.dsub {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.ditem {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-control);
  background: var(--ot-raised);
  font-size: 14px;
}
</style>
