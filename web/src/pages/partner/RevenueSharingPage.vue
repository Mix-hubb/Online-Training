<script setup lang="ts">
// Partner portal: own totals, courses and share %, ledger with filters, CSV export (spec 15.9).
import { onMounted, ref, watch } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import RevenueTable from '@/components/revenue/RevenueTable.vue';
import RevenueTotalsCards from '@/components/revenue/RevenueTotalsCards.vue';
import * as partnerApi from '@/api/partner';
import type { RevenueRow } from '@/types';
import { percentBp } from '@/utils/format';

const f = ref<partnerApi.RevenueFilter>({ from: '', to: '', course: '', currency: '', status: '' });
const sum = ref<partnerApi.PartnerSummary | null>(null);
const rows = ref<RevenueRow[]>([]);
const loading = ref(true);
const failed = ref(false);

async function load() {
  loading.value = true;
  try {
    [sum.value, rows.value] = await Promise.all([partnerApi.summary(f.value), partnerApi.revenue(f.value)]);
    failed.value = false;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(f, load, { deep: true });
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Revenue sharing" :subtitle="`${sum?.partner.name ? sum.partner.name + ' · ' : ''}Your share of each paid order. Amounts in USD and THB are shown separately.`">
      <v-btn variant="outlined" prepend-icon="mdi-download" @click="partnerApi.csv(f)">Export CSV</v-btn>
    </AdminPageHeader>
    <div v-if="failed" class="callout danger" role="alert">The report could not be loaded.</div>
    <template v-if="sum">
      <RevenueTotalsCards :totals="sum.totals" />
      <section class="d-flex flex-column ga-3">
        <h2 class="section-title my-0">Your share</h2>
        <p class="text-body-2 ma-0">
          <span class="tag accent">{{ percentBp(sum.sharePercentBp) }} of total revenue</span>
          <span class="text-muted ml-2">from every course. Each entry keeps the percent that applied when the order was paid.</span>
        </p>
      </section>
    </template>
    <section class="d-flex flex-column ga-3">
      <h2 class="section-title my-0">Entries</h2>
      <div class="filters">
        <div class="grow1"><label for="p-from" class="sr-only">From</label><input id="p-from" v-model="f.from" type="date" class="ot-input" /></div>
        <div class="grow1"><label for="p-to" class="sr-only">To</label><input id="p-to" v-model="f.to" type="date" class="ot-input" /></div>
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
      <v-progress-linear v-if="loading" indeterminate color="primary" />
      <RevenueTable :rows="rows" />
    </section>
  </div>
</template>
