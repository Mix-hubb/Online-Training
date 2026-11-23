<script setup lang="ts">
// Revenue sharing (admin): ledger with filters + CSV, balances per partner and currency, mark as paid, payouts.
import { computed, onMounted, ref, watch } from 'vue';
import RevenueTotalsCards from '@/components/revenue/RevenueTotalsCards.vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import PayoutsTable from '@/components/revenue/PayoutsTable.vue';
import RevenueTable from '@/components/revenue/RevenueTable.vue';
import RevenueChart from '@/components/revenue/RevenueChart.vue';
import RevenuePeriod from '@/components/revenue/RevenuePeriod.vue';
import { periodLabel, periodQuery, thisMonth, type Period } from '@/utils/period';
import * as api from '@/api/admin/revenue';
import * as partnersApi from '@/api/admin/partners';
import * as coursesApi from '@/api/admin/courses';
import { errorMessage } from '@/api/client';
import type { Payout, RevenuePoint, RevenueRow, RevenueTotals } from '@/types';
import { money } from '@/utils/format';

const tab = ref('ledger');
const period = ref<Period>(thisMonth());
const f = ref<api.RevenueQuery>({ course: '', partner: '', currency: '', status: '' });
const q = computed(() => ({ ...f.value, ...periodQuery(period.value) }));
const loadingReport = ref(false);
const rows = ref<RevenueRow[]>([]);
const points = ref<RevenuePoint[]>([]);
const totalRows = ref(0);
const sum = ref<RevenueTotals>({});
const balances = ref<Awaited<ReturnType<typeof api.balances>>>([]);
const payouts = ref<Payout[]>([]);
const partners = ref<partnersApi.PartnerRow[]>([]);
const courses = ref<coursesApi.AdminCourseRow[]>([]);
const pay = ref<{ partnerId: string; partnerName: string; currency: string; amount: number; reference: string; note: string } | null>(null);
const busy = ref(false);
const err = ref('');

async function loadReport() {
  loadingReport.value = true;
  try {
    const r = await api.report(q.value);
    rows.value = r.rows;
    points.value = r.daily;
    totalRows.value = r.total;
    sum.value = r.summary;
  } finally {
    loadingReport.value = false;
  }
}
async function loadAll() {
  await Promise.all([loadReport(), api.balances().then((b) => (balances.value = b)), api.payouts().then((p) => (payouts.value = p))]);
}
onMounted(async () => {
  void loadAll();
  partners.value = await partnersApi.list(true);
  courses.value = (await coursesApi.list({ page: 1 })).items;
});
watch(q, loadReport);
async function markPaid() {
  const p = pay.value!;
  busy.value = true;
  err.value = '';
  try {
    await api.markPaid({ partnerId: p.partnerId, currency: p.currency, reference: p.reference || undefined, note: p.note || undefined });
    pay.value = null;
    await loadAll();
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Revenue sharing" subtitle="Ledger entries are created when an order is paid, one per partner, using each partner's share at that moment. USD and THB are kept separate." />
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <div class="chipbar" role="group" aria-label="Revenue views">
      <button type="button" :aria-pressed="tab === 'ledger'" @click="tab = 'ledger'">Ledger</button>
      <button type="button" :aria-pressed="tab === 'balances'" @click="tab = 'balances'">Balances ({{ balances.length }})</button>
      <button type="button" :aria-pressed="tab === 'payouts'" @click="tab = 'payouts'">Payouts</button>
    </div>
    <template v-if="tab === 'ledger'">
      <RevenuePeriod v-model="period" />
      <div class="filters">
        <div class="grow1">
          <label for="r-p" class="sr-only">Partner</label>
          <select id="r-p" v-model="f.partner" class="ot-select"><option value="">All partners</option><option v-for="p in partners" :key="p.id" :value="p.id">{{ p.name }}</option></select>
        </div>
        <div class="grow1">
          <label for="r-c" class="sr-only">Course</label>
          <select id="r-c" v-model="f.course" class="ot-select"><option value="">All courses</option><option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option></select>
        </div>
        <div class="grow1">
          <label for="r-cur" class="sr-only">Currency</label>
          <select id="r-cur" v-model="f.currency" class="ot-select"><option value="">All currencies</option><option value="usd">USD</option><option value="thb">THB</option></select>
        </div>
        <div class="grow1">
          <label for="r-s" class="sr-only">Status</label>
          <select id="r-s" v-model="f.status" class="ot-select"><option value="">All statuses</option><option value="UNPAID">Unpaid</option><option value="PAID">Paid</option></select>
        </div>
      </div>
      <div class="text-body-2 text-muted mt-n3">Showing {{ periodLabel(period) }}</div>
      <RevenueTotalsCards :totals="sum" />
      <RevenueChart :points="points" :period="period" :loading="loadingReport" />
      <div class="d-flex justify-end"><v-btn variant="outlined" prepend-icon="mdi-download" @click="api.csv(q)">Export CSV</v-btn></div>
      <p v-if="totalRows > rows.length" class="text-body-2 text-muted ma-0">Showing the latest {{ rows.length.toLocaleString() }} of {{ totalRows.toLocaleString() }} entries. Totals and the chart include all of them; Export CSV has every entry.</p>
      <RevenueTable :rows="rows" show-partner />
    </template>
    <template v-else-if="tab === 'balances'">
      <div v-if="!balances.length" class="panel pa-8 text-center text-body-2 text-muted">Nothing outstanding.</div>
      <table v-else class="data-table">
        <caption class="sr-only">Outstanding balances</caption>
        <thead><tr><th scope="col">Partner</th><th scope="col">Currency</th><th scope="col">Entries</th><th scope="col" class="text-right">Outstanding</th><th scope="col" class="text-right">Action</th></tr></thead>
        <tbody>
          <tr v-for="b in balances" :key="b.partnerId + b.currency">
            <td>{{ b.partnerName }}</td><td>{{ b.currency.toUpperCase() }}</td><td>{{ b.entries }}</td>
            <td class="text-right font-weight-bold">{{ money(b.outstandingMinor, b.currency) }}</td>
            <td class="text-right"><v-btn size="small" color="primary" :disabled="b.outstandingMinor <= 0" @click="pay = { partnerId: b.partnerId, partnerName: b.partnerName, currency: b.currency, amount: b.outstandingMinor, reference: '', note: '' }">Mark as paid</v-btn></td>
          </tr>
        </tbody>
      </table>
    </template>
    <PayoutsTable v-else :payouts="payouts" show-partner />

    <v-dialog :model-value="!!pay" max-width="480" @update:model-value="pay = null">
      <v-card v-if="pay" color="surface" class="pa-2">
        <v-card-title>Mark as paid</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-4">Record that you transferred <b>{{ money(pay.amount, pay.currency) }}</b> to {{ pay.partnerName }}. All unpaid {{ pay.currency.toUpperCase() }} entries are linked to this payout. This does not move money; make the transfer in your bank first.</p>
          <v-text-field v-model="pay.reference" label="Bank reference (optional)" class="mb-2" />
          <v-text-field v-model="pay.note" label="Note (optional)" />
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="pay = null">Cancel</v-btn><v-btn color="primary" variant="flat" :loading="busy" @click="markPaid">Record payout</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
