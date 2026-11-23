<script setup lang="ts">
// Partner portal: own totals, courses and share %, ledger with filters, CSV export (spec 15.9).
// The period (a month, or specific days) and the other filters scope the totals, the chart and the entries.
import { computed, onMounted, ref, watch } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import RevenueTable from '@/components/revenue/RevenueTable.vue';
import RevenueTotalsCards from '@/components/revenue/RevenueTotalsCards.vue';
import RevenueChart from '@/components/revenue/RevenueChart.vue';
import RevenuePeriod from '@/components/revenue/RevenuePeriod.vue';
import { periodLabel, periodQuery, thisMonth, type Period } from '@/utils/period';
import * as partnerApi from '@/api/partner';
import type { RevenueRow } from '@/types';
import { percentBp } from '@/utils/format';

const period = ref<Period>(thisMonth());
const f = ref<partnerApi.RevenueFilter>({ course: '', currency: '', status: '' });
const q = computed(() => ({ ...f.value, ...periodQuery(period.value) }));
const sum = ref<partnerApi.PartnerSummary | null>(null);
const rows = ref<RevenueRow[]>([]);
const loading = ref(true);
const failed = ref(false);

async function load() {
  loading.value = true;
  try {
    [sum.value, rows.value] = await Promise.all([partnerApi.summary(q.value), partnerApi.revenue(q.value)]);
    failed.value = false;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(q, load);
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Revenue sharing" :subtitle="`${sum?.partner.name ? sum.partner.name + ' · ' : ''}Your share of each paid order. Amounts in USD and THB are shown separately.`">
      <v-btn variant="outlined" prepend-icon="mdi-download" @click="partnerApi.csv(q)">Export CSV</v-btn>
    </AdminPageHeader>
    <div v-if="failed" class="callout danger" role="alert">The report could not be loaded.</div>
    <div class="d-flex flex-column ga-3">
      <RevenuePeriod v-model="period" />
      <div class="filters">
        <div class="grow2">
          <label for="p-c" class="sr-only">Course</label>
          <select id="p-c" v-model="f.course" class="ot-select"><option value="">All courses</option><option v-for="c in sum?.courses ?? []" :key="c.id" :value="c.id">{{ c.title }}</option></select>
        </div>
        <div class="grow1">
          <label for="p-cur" class="sr-only">Currency</label>
          <select id="p-cur" v-model="f.currency" class="ot-select"><option value="">All currencies</option><option value="usd">USD</option><option value="thb">THB</option></select>
        </div>
        <div class="grow1">
          <label for="p-s" class="sr-only">Status</label>
          <select id="p-s" v-model="f.status" class="ot-select"><option value="">All statuses</option><option value="UNPAID">Unpaid</option><option value="PAID">Paid out</option></select>
        </div>
      </div>
      <div class="text-body-2 text-muted">Showing {{ periodLabel(period) }}</div>
    </div>
    <template v-if="sum">
      <RevenueTotalsCards :totals="sum.totals" />
      <section class="d-flex flex-column ga-3">
        <h2 class="section-title my-0">Your share</h2>
        <p class="text-body-2 ma-0">
          <span class="tag accent">{{ percentBp(sum.sharePercentBp) }}</span>
          <span class="text-muted ml-2">of each paid order on every course, after the course's instructor shares. Each entry keeps the percent that applied when the order was paid.</span>
        </p>
      </section>
    </template>
    <RevenueChart :rows="rows" :period="period" :loading="loading" />
    <section class="d-flex flex-column ga-3">
      <h2 class="section-title my-0">Entries</h2>
      <v-progress-linear v-if="loading" indeterminate color="primary" />
      <RevenueTable :rows="rows" />
    </section>
  </div>
</template>
