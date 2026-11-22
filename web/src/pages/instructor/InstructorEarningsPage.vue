<script setup lang="ts">
// Instructor earnings: only when the instructor is linked to a Partner record with a share.
import { onMounted, ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import PayoutsTable from '@/components/revenue/PayoutsTable.vue';
import RevenueTable from '@/components/revenue/RevenueTable.vue';
import RevenueTotalsCards from '@/components/revenue/RevenueTotalsCards.vue';
import * as insApi from '@/api/instructor';
import { percentBp } from '@/utils/format';

const d = ref<Awaited<ReturnType<typeof insApi.earnings>> | null>(null);
onMounted(async () => (d.value = await insApi.earnings()));
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Earnings" subtitle="Your share of paid orders on the courses you teach. USD and THB are kept separate.">
      <v-btn v-if="d?.linked" variant="outlined" prepend-icon="mdi-download" @click="insApi.earningsCsv()">Export CSV</v-btn>
    </AdminPageHeader>
    <v-skeleton-loader v-if="!d" type="card" color="surface" />
    <EmptyState v-else-if="!d.linked" class="panel" icon="mdi-cash-off" title="No revenue share" text="You do not have a revenue share on any course. Contact the admin if you think this is wrong." />
    <template v-else>
      <RevenueTotalsCards :totals="d.totals" />
      <section class="d-flex flex-column ga-3">
        <!-- TODO(open question 2026-11-22): whether instructors still get a revenue share. Shown as before for now. -->
        <h2 class="section-title my-0">Your share</h2>
        <p class="text-body-2 ma-0"><span class="tag accent">{{ percentBp(d.sharePercentBp) }} of total revenue</span></p>
      </section>
      <section class="d-flex flex-column ga-3">
        <h2 class="section-title my-0">Entries</h2>
        <RevenueTable :rows="d.rows" />
      </section>
      <section class="d-flex flex-column ga-3">
        <h2 class="section-title my-0">Payouts</h2>
        <PayoutsTable :payouts="d.payouts" />
      </section>
    </template>
  </div>
</template>
