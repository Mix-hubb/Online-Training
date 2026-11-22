<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import PayoutsTable from '@/components/revenue/PayoutsTable.vue';
import * as partnerApi from '@/api/partner';
import type { Payout } from '@/types';
const payouts = ref<Payout[] | null>(null);
onMounted(async () => (payouts.value = await partnerApi.payouts().catch(() => [])));
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Payouts" subtitle="Transfers the company has made to you. Each payout covers the unpaid entries up to its date." />
    <v-skeleton-loader v-if="!payouts" type="table" color="surface" />
    <PayoutsTable v-else :payouts="payouts" />
  </div>
</template>
