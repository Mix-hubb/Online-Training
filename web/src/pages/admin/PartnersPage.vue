<script setup lang="ts">
// Partners (spec 15.8 + 15.9): logo + order on the home page, revenue share, partner login.
// Revenue share (2026-11-22): co-investors have ONE percentage, taken from each sale AFTER that course's instructor shares;
// all co-investors together <= 100%. Instructors are paid per course and are listed on the Instructors page, not here.
// A new percentage applies only to orders paid after the change.
// Temporary passwords are shown once, here, and never stored in plain text.
import { computed, onMounted, ref } from 'vue';
import StatusPill from '@/components/common/StatusPill.vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import * as api from '@/api/admin/partners';
import { errorMessage, fileToBase64 } from '@/api/client';
import { money, percentBp } from '@/utils/format';

const rows = ref<api.PartnerRow[]>([]);
const edit = ref<(api.PartnerInput & { id?: string; sharePercent: string }) | null>(null);
const acct = ref<{ id: string; email: string } | null>(null);
const temp = ref<{ email: string; temporaryPassword: string } | null>(null);
const del = ref<api.PartnerRow | null>(null);
const busy = ref(false);
const err = ref('');
async function load() {
  rows.value = await api.list();
}
onMounted(load);
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
const totalBp = computed(() => rows.value.reduce((s, r) => s + r.sharePercentBp, 0));
/** Percent typed in the form -> basis points (2 decimals). NaN when not a valid 0..100 number. */
const toBp = (v: string) => {
  const t = String(v ?? '').trim();
  if (t === '') return 0;
  const n = Number(t);
  return /^\d+(\.\d{1,2})?$/.test(t) && n >= 0 && n <= 100 ? Math.round(n * 100) : NaN;
};
const formBp = computed(() => (edit.value ? toBp(edit.value.sharePercent) : 0));
const othersBp = computed(() => rows.value.filter((r) => r.id !== edit.value?.id).reduce((s, r) => s + r.sharePercentBp, 0));
const formError = computed(() => {
  if (!edit.value) return '';
  if (Number.isNaN(formBp.value)) return 'Enter a number from 0 to 100, up to 2 decimals.';
  if (othersBp.value + formBp.value > 10000) return `All partners would add up to ${percentBp(othersBp.value + formBp.value)}. The maximum is 100%.`;
  return '';
});
function openEdit(p?: api.PartnerRow) {
  edit.value = p
    ? { id: p.id, name: p.name, contact: p.contact, websiteUrl: p.websiteUrl, showLogo: p.showLogo, sharePercent: String(p.sharePercentBp / 100) }
    : { name: '', contact: '', websiteUrl: '', showLogo: true, sharePercent: '0' };
}
async function save() {
  const e = edit.value!;
  if (!e.name?.trim() || formError.value) return;
  const body = {
    name: e.name.trim(),
    contact: e.contact || null,
    websiteUrl: e.websiteUrl || null,
    showLogo: e.showLogo,
    sharePercentBp: formBp.value,
  };
  if (await run(() => (e.id ? api.update(e.id, body) : api.create(body)))) edit.value = null;
}
async function logo(p: api.PartnerRow, ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (!f) return;
  await run(async () => api.uploadLogo(p.id, { name: f.name, dataBase64: await fileToBase64(f) }));
}
async function move(i: number, d: -1 | 1) {
  const ids = rows.value.map((r) => r.id);
  const j = i + d;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  await run(() => api.logoOrder(ids));
}
async function createAccount() {
  const a = acct.value!;
  await run(async () => {
    temp.value = await api.createAccount(a.id, a.email.trim());
    acct.value = null;
  });
}
async function reset(p: api.PartnerRow) {
  await run(async () => (temp.value = await api.resetPassword(p.id)));
}
async function copy() {
  await navigator.clipboard.writeText(temp.value!.temporaryPassword).catch(() => undefined);
}
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Partners" subtitle="Co-investors who share revenue. Logos marked “shown” appear on the home page and footer in this order. Each partner can have a login to see its own share.">
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openEdit()">Add partner</v-btn>
    </AdminPageHeader>
    <div class="callout" :class="{ danger: totalBp > 10000 }">
      <span>
        Instructors are paid first, from the courses they teach (see the <router-link to="/admin/instructors">Instructors</router-link> page).
        Co-investors then get their percent of what is left. Co-investors together: <strong>{{ percentBp(totalBp) }}</strong> · company keeps <strong>{{ percentBp(Math.max(0, 10000 - totalBp)) }}</strong> of what is left.
        A new percentage applies only to orders paid after the change.
      </span>
    </div>
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <div v-if="!rows.length" class="panel pa-10 text-center text-body-2 text-muted">No partners yet.</div>
    <div v-else class="table-scroll">
      <table class="data-table" style="min-width: 960px">
        <caption class="sr-only">Partners</caption>
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Partner</th>
            <th scope="col" class="text-right">Revenue share</th>
            <th scope="col">Show on home</th>
            <th scope="col">Login</th>
            <th scope="col" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in rows" :key="p.id">
            <td class="text-no-wrap">
              <span class="d-inline-flex align-center ga-1">
                {{ i + 1 }}
                <v-btn icon="mdi-chevron-up" size="x-small" variant="text" :disabled="i === 0" :aria-label="`Move ${p.name} up`" @click="move(i, -1)" />
                <v-btn icon="mdi-chevron-down" size="x-small" variant="text" :disabled="i === rows.length - 1" :aria-label="`Move ${p.name} down`" @click="move(i, 1)" />
              </span>
            </td>
            <td>
              <div class="d-flex align-center ga-3">
                <label class="logo" :title="p.logoUrl ? 'Replace logo' : 'Upload logo'">
                  <img v-if="p.logoUrl" :src="p.logoUrl" :alt="p.name" />
                  <span v-else>logo</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" :aria-label="`Upload logo for ${p.name}`" @change="logo(p, $event)" />
                </label>
                <div style="min-width: 0">
                  <div class="font-weight-bold">{{ p.name }}</div>
                  <div class="text-caption text-muted">Co-investor<template v-if="p.contact"> · {{ p.contact }}</template></div>
                  <div v-if="p.websiteUrl" class="text-caption text-muted">{{ p.websiteUrl }}</div>
                  <div v-if="p.outstanding.length" class="text-caption mt-1" style="color: var(--ot-warning)">Outstanding: <span v-for="o in p.outstanding" :key="o.currency" class="mr-2">{{ money(o.amountMinor, o.currency) }}</span></div>
                </div>
              </div>
            </td>
            <td class="text-right text-no-wrap">
              <span v-if="p.sharePercentBp" class="font-weight-bold">{{ percentBp(p.sharePercentBp) }}</span>
              <span v-else class="text-caption text-muted">No share</span>
            </td>
            <td><StatusPill :label="p.showLogo ? 'Shown' : 'Hidden'" :tone="p.showLogo ? 'success' : 'neutral'" /></td>
            <td>
              <template v-if="p.user">
                <div class="text-body-2">{{ p.user.email }}</div>
                <div class="text-caption text-muted">Partner account<span v-if="p.user.mustChangePassword"> · temporary password</span></div>
              </template>
              <span v-else class="text-caption text-muted">No login</span>
            </td>
            <td class="text-right text-no-wrap">
              <button v-if="!p.user" type="button" class="row-btn" @click="acct = { id: p.id, email: '' }">Create login</button>
              <button v-else type="button" class="row-btn" @click="reset(p)">Reset password</button>
              <button type="button" class="row-link" @click="openEdit(p)">Edit</button>
              <button type="button" class="row-link danger" @click="del = p">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <v-dialog :model-value="!!edit" max-width="520" @update:model-value="edit = null">
      <v-card v-if="edit" color="surface" class="pa-2">
        <v-card-title>{{ edit.id ? 'Edit partner' : 'New partner' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="edit.name" label="Name" class="mb-2" />
          <v-text-field v-model="edit.contact" label="Contact (person, email or phone)" class="mb-2" />
          <v-text-field v-model="edit.websiteUrl" label="Website (optional)" placeholder="https://" class="mb-2" />
          <v-text-field
            v-model="edit.sharePercent"
            label="Share of each sale after instructors (%)"
            inputmode="decimal"
            suffix="%"
            class="mb-2"
            :error-messages="formError || undefined"
            :hint="`Other co-investors: ${percentBp(othersBp)} · available: ${percentBp(Math.max(0, 10000 - othersBp))}. Applies to all courses, after instructor shares.`"
            persistent-hint
          />
          <v-switch v-model="edit.showLogo" label="Show logo on the home page" color="primary" hide-details />
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="edit = null">Cancel</v-btn><v-btn color="primary" variant="flat" :loading="busy" :disabled="!!formError || !edit.name?.trim()" @click="save">Save</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog :model-value="!!acct" max-width="480" @update:model-value="acct = null">
      <v-card v-if="acct" color="surface" class="pa-2">
        <v-card-title>Create partner login</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-muted mb-4">The partner can only see their own revenue sharing and payouts. They must change the temporary password on first login.</p>
          <v-text-field v-model="acct.email" label="Partner's email" type="email" />
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="acct = null">Cancel</v-btn><v-btn color="primary" variant="flat" :loading="busy" @click="createAccount">Create</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog :model-value="!!temp" max-width="480" persistent>
      <v-card v-if="temp" color="surface" class="pa-2">
        <v-card-title>Temporary password</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-3">Give this to {{ temp.email }} through a safe channel. It is shown only now.</p>
          <div class="d-flex align-center ga-2 pa-3 rounded" style="background: var(--ot-deep); border: 1px solid var(--ot-border)"><span class="mono flex-grow-1">{{ temp.temporaryPassword }}</span><v-btn size="small" variant="text" icon="mdi-content-copy" aria-label="Copy" @click="copy" /></div>
          <p class="text-caption text-muted mt-3 mb-0">The partner can also use “Forgot password” on the login page.</p>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn color="primary" variant="flat" @click="temp = null">Done</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <ConfirmDialog :model-value="!!del" :title="`Delete ${del?.name}?`" danger confirm-label="Delete" :loading="busy" @update:model-value="del = null" @confirm="run(() => api.remove(del!.id)).then(() => (del = null))">
      Partners with a share or ledger entries cannot be deleted. Set the share to 0% and hide the logo instead.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.logo {
  width: 88px;
  height: var(--ot-control-h);
  flex: none;
  border: 1px dashed var(--ot-input-border);
  border-radius: var(--ot-radius-control);
  background: var(--ot-raised);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--ot-faint);
  cursor: pointer;
  overflow: hidden;
}
.logo:focus-within {
  outline: 2px solid var(--ot-accent);
  outline-offset: 2px;
}
.logo img {
  max-width: 80px;
  max-height: 32px;
  object-fit: contain;
}
</style>
