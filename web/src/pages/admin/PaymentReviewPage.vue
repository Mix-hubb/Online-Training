<script setup lang="ts">
// Bank slip review: approve (marks the order paid, enrols, creates ledger entries) or reject with a reason.
import { computed, onMounted, ref, watch } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import * as api from '@/api/admin/paymentReview';
import { errorMessage } from '@/api/client';
import { dateTime, money } from '@/utils/format';

const status = ref<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
const rows = ref<api.SlipRow[] | null>(null);
const approving = ref<api.SlipRow | null>(null);
const rejecting = ref<api.SlipRow | null>(null);
const reason = ref('');
const busy = ref(false);
const err = ref('');
const selId = ref<string | null>(null);
const cur = computed(() => rows.value?.find((r) => r.slipId === selId.value) ?? rows.value?.[0] ?? null);
const tabs = [
  { v: 'PENDING' as const, t: 'Waiting' },
  { v: 'APPROVED' as const, t: 'Approved' },
  { v: 'REJECTED' as const, t: 'Rejected' },
];
const statusLabel: Record<string, string> = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' };
async function load() {
  rows.value = await api.list(status.value);
}
onMounted(load);
watch(status, load);
async function run(fn: () => Promise<unknown>) {
  busy.value = true;
  err.value = '';
  try {
    await fn();
    approving.value = null;
    rejecting.value = null;
    reason.value = '';
    await load();
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Bank transfer slips" subtitle="Check each slip against the bank statement. Approving opens the course for the learner." />
    <div class="chipbar" role="group" aria-label="Status">
      <button v-for="o in tabs" :key="o.v" type="button" :aria-pressed="status === o.v" @click="status = o.v">{{ o.t }}</button>
    </div>
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <v-skeleton-loader v-if="!rows" type="card" color="surface" />
    <div v-else-if="!rows.length" class="panel pa-10 text-center text-body-2 text-muted">No slips here.</div>
    <div v-else class="cols">
      <ul class="slist panel">
        <li v-for="s in rows" :key="s.slipId">
          <button type="button" class="srow" :class="{ on: cur?.slipId === s.slipId }" :aria-current="cur?.slipId === s.slipId ? 'true' : undefined" @click="selId = s.slipId">
            <span class="d-flex justify-space-between ga-2 font-weight-bold text-body-2"><span>{{ s.order.user.name }}</span><span>{{ money(s.order.amountMinor, s.order.currency) }}</span></span>
            <span class="text-body-2 text-muted">{{ s.order.id.slice(-8).toUpperCase() }} · {{ dateTime(s.createdAt) }}</span>
            <StatusPill class="align-self-start" :label="statusLabel[s.status]" :tone="s.status === 'APPROVED' ? 'success' : s.status === 'REJECTED' ? 'danger' : 'warning'" />
          </button>
        </li>
      </ul>
      <section v-if="cur" class="panel detail" aria-label="Slip detail">
        <a :href="cur.url" target="_blank" rel="noopener" class="slip"><img :src="cur.url" alt="Transfer slip" /></a>
        <div class="dright">
          <h2 class="h2">{{ cur.order.user.name }}</h2>
          <dl class="dl">
            <dt>Email</dt>
            <dd>{{ cur.order.user.email }}</dd>
            <dt>Order</dt>
            <dd class="mono">{{ cur.order.id.slice(-8).toUpperCase() }}</dd>
            <dt>Course</dt>
            <dd>{{ cur.order.course.title }}</dd>
            <dt>Expected amount</dt>
            <dd class="font-weight-bold">{{ money(cur.order.amountMinor, cur.order.currency) }}</dd>
            <dt>Uploaded</dt>
            <dd>{{ dateTime(cur.createdAt) }}</dd>
          </dl>
          <div v-if="cur.reason" class="callout danger">Reason: {{ cur.reason }}</div>
          <template v-if="cur.status === 'PENDING'">
            <div>
              <label for="rj" class="d-block text-body-2 text-muted mb-1">Reason (needed to reject)</label>
              <input id="rj" v-model="reason" type="text" class="ot-input" placeholder="e.g. amount does not match" maxlength="500" />
            </div>
            <div class="d-flex flex-wrap ga-2 mt-auto">
              <v-btn color="primary" min-height="46" @click="approving = cur">Approve and open course</v-btn>
              <v-btn variant="outlined" color="error" min-height="46" :disabled="!reason.trim()" :loading="busy && !approving" @click="run(() => api.reject(cur!.order.id, reason.trim()))">Reject</v-btn>
            </div>
          </template>
        </div>
      </section>
    </div>
    <ConfirmDialog :model-value="!!approving" title="Approve this payment?" confirm-label="Approve" :loading="busy" @update:model-value="approving = null" @confirm="run(() => api.approve(approving!.order.id))">
      The learner gets access to the course right away and is notified. Revenue shares are recorded.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.cols {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-start;
}
.slist {
  flex: 1 1 320px;
  max-width: 400px;
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
.srow {
  width: 100%;
  text-align: left;
  cursor: pointer;
  padding: 16px 16px 16px 13px;
  border: 0;
  border-bottom: 1px solid var(--ot-border);
  border-left: 3px solid transparent;
  background: transparent;
  color: var(--ot-text);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.srow.on {
  border-left-color: var(--ot-accent);
  background: var(--ot-info-bg);
}
.srow:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: -2px;
}
.detail {
  flex: 2 1 460px;
  min-width: 0;
  padding: 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}
.slip {
  flex: 1 1 240px;
  min-height: 360px;
  border-radius: var(--ot-radius-control);
  border: 1px solid var(--ot-input-border);
  background: var(--ot-deep);
  overflow: hidden;
  display: block;
}
.slip img {
  width: 100%;
  height: 100%;
  max-height: 520px;
  object-fit: contain;
  display: block;
}
.dright {
  flex: 1 1 260px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.dl {
  margin: 0;
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px 12px;
  font-size: 14px;
}
.dl dt {
  color: var(--ot-muted);
}
.dl dd {
  margin: 0;
  word-break: break-word;
}
@media (max-width: 760px) {
  .slist {
    max-width: none;
  }
}
</style>
