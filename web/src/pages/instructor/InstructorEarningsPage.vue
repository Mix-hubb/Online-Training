<script setup lang="ts">
// Instructor earnings: the instructor's share of each course they are assigned to (set by the admin per course).
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
        <h2 class="section-title my-0">Your share per course</h2>
        <p class="text-body-2 text-muted ma-0">You get this share of every paid order on the course. Each entry keeps the percent that applied when the order was paid.</p>
        <ul v-if="d.courseShares.length" class="shares panel">
          <li v-for="c in d.courseShares" :key="c.id">
            <span>{{ c.title }}</span>
            <span v-if="c.sharePercentBp" class="tag accent">{{ percentBp(c.sharePercentBp) }}</span>
            <span v-else class="text-caption text-muted">No share</span>
          </li>
        </ul>
        <p v-else class="text-body-2 text-muted ma-0">You are not assigned to a course right now.</p>
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

<style scoped>
.shares {
  list-style: none;
  margin: 0;
  padding: 0 20px;
}
.shares li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid var(--ot-border);
}
.shares li:first-child {
  border-top: 0;
}
</style>
  </div>
</template>
