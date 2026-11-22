<script setup lang="ts">
import type { Payout } from '@/types';
import { date, money } from '@/utils/format';
defineProps<{ payouts: Payout[]; showPartner?: boolean }>();
</script>

<template>
  <div v-if="!payouts.length" class="panel pa-8 text-center text-body-2 text-muted">No payouts yet.</div>
  <div v-else class="table-scroll">
    <table class="data-table" style="min-width: 760px">
      <caption class="sr-only">Payouts</caption>
      <thead>
        <tr>
          <th scope="col">Paid on</th>
          <th v-if="showPartner" scope="col">Partner</th>
          <th scope="col">Period</th>
          <th scope="col">Reference</th>
          <th scope="col">Entries</th>
          <th scope="col" class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in payouts" :key="p.id">
          <td class="text-no-wrap">{{ date(p.paidAt) }}</td>
          <td v-if="showPartner" class="font-weight-medium">{{ p.partner?.name }}</td>
          <td class="text-no-wrap text-2">{{ p.periodFrom ? date(p.periodFrom) : '…' }} – {{ p.periodTo ? date(p.periodTo) : date(p.paidAt) }}</td>
          <td>{{ p.reference ?? '—' }}<div v-if="p.note" class="text-caption text-muted">{{ p.note }}</div></td>
          <td>{{ p._count?.entries ?? '—' }}</td>
          <td class="text-right text-no-wrap font-weight-bold">{{ money(p.totalMinor, p.currency) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
