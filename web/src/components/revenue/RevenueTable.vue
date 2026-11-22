<script setup lang="ts">
// Ledger rows (one per partner per paid order).
import StatusPill from '@/components/common/StatusPill.vue';
import type { RevenueRow } from '@/types';
import { date, money, percentBp } from '@/utils/format';
defineProps<{ rows: RevenueRow[]; showPartner?: boolean }>();
</script>

<template>
  <div v-if="!rows.length" class="panel pa-8 text-center text-body-2 text-muted">No entries for these filters.</div>
  <div v-else class="table-scroll">
    <table class="data-table" style="min-width: 880px">
      <caption class="sr-only">Revenue entries</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th v-if="showPartner" scope="col">Partner</th>
          <th scope="col">Course</th>
          <th scope="col">Order</th>
          <th scope="col" class="text-right">Sale</th>
          <th scope="col" class="text-right">Share</th>
          <th scope="col" class="text-right">Amount</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id">
          <td class="text-no-wrap text-2">{{ date(r.date) }}</td>
          <td v-if="showPartner" class="font-weight-medium">{{ r.partnerName }}</td>
          <td>{{ r.courseTitle }}</td>
          <td class="mono text-caption text-no-wrap">{{ r.orderRef }}</td>
          <td class="text-right text-no-wrap">{{ money(r.baseMinor, r.currency) }}</td>
          <td class="text-right">{{ percentBp(r.percentBp) }}</td>
          <td class="text-right text-no-wrap font-weight-bold" :style="r.amountMinor < 0 ? 'color: var(--ot-danger)' : ''">{{ money(r.amountMinor, r.currency) }}</td>
          <td><StatusPill :label="r.status === 'PAID' ? 'Paid out' : 'Unpaid'" :tone="r.status === 'PAID' ? 'success' : 'warning'" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
