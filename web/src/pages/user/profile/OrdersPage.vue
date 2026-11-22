<script setup lang="ts">
// Orders and receipts. ?session_id=... (Stripe return) shows "Confirming payment" until the webhook marks it PAID.
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import EmptyState from '@/components/common/EmptyState.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import * as ordersApi from '@/api/orders';
import { useOrderPolling } from '@/composables/useOrderPolling';
import type { Order } from '@/types';
import { date, methodLabel, money } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const orders = ref<Order[] | null>(null);
const { order: polled, state, start } = useOrderPolling();

async function load() {
  orders.value = await ordersApi.myOrders().catch(() => []);
}
onMounted(() => {
  void load();
  const sid = route.query.session_id;
  if (typeof sid === 'string' && sid) start(sid);
});
watch(state, (s) => {
  if (s === 'paid' || s === 'failed') void load();
});
const statusInfo: Record<Order['status'], { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  PAID: { label: 'Paid', tone: 'success' },
  PENDING: { label: 'Pending', tone: 'warning' },
  AWAITING_SLIP: { label: 'Bank transfer', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
};
function dismiss() {
  state.value = 'idle';
  void router.replace({ query: {} });
}
</script>

<template>
  <div class="page orders">
    <div class="d-flex flex-column ga-1">
      <router-link to="/profile" class="back">← My learning</router-link>
      <h1 class="page-title mb-0">Orders and receipts</h1>
    </div>

    <div v-if="state === 'polling'" class="callout" role="status">
      <v-progress-circular indeterminate size="18" width="2" color="primary" />
      <span><strong>Confirming your payment…</strong> This usually takes a few seconds. Your course unlocks as soon as it is confirmed.</span>
    </div>
    <div v-else-if="state === 'paid'" class="callout success" role="status">
      <span class="flex-grow-1"><strong>Payment confirmed.</strong> {{ polled?.course?.title }} is ready for you.</span>
      <v-btn v-if="polled?.course" color="primary" size="small" :to="`/learn/${polled.course.slug}`">Start learning</v-btn>
      <v-btn size="small" variant="text" icon="mdi-close" aria-label="Dismiss" @click="dismiss" />
    </div>
    <div v-else-if="state === 'failed'" class="callout danger" role="alert">
      <span class="flex-grow-1">The payment did not go through. You have not been charged. Try again from the course page.</span>
      <v-btn size="small" variant="text" icon="mdi-close" aria-label="Dismiss" @click="dismiss" />
    </div>
    <div v-else-if="state === 'timeout'" class="callout warning" role="status">
      <span class="flex-grow-1">It is taking longer than usual. If you were charged, access will appear here shortly. Contact support if it does not.</span>
      <v-btn size="small" variant="text" icon="mdi-close" aria-label="Dismiss" @click="dismiss" />
    </div>

    <v-skeleton-loader v-if="!orders" type="table" color="surface" />
    <EmptyState v-else-if="!orders.length" class="panel" icon="mdi-receipt-text-outline" title="No orders yet" text="Paid courses you buy appear here with their receipts." action-label="Browse courses" action-to="/" />
    <div v-else class="table-wrap">
      <table class="data-table">
        <caption class="sr-only">Your orders</caption>
        <thead>
          <tr><th scope="col">Date</th><th scope="col">Course</th><th scope="col">Method</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Receipt</th></tr>
        </thead>
        <tbody>
          <tr v-for="o in orders" :key="o.id">
            <td class="text-no-wrap text-2">{{ date(o.paidAt ?? o.createdAt) }}</td>
            <td class="font-weight-medium">
              <router-link v-if="o.course" :to="`/courses/${o.course.slug}`" class="course">{{ o.course.title }}</router-link>
            </td>
            <td class="text-no-wrap text-2">{{ o.method ? methodLabel[o.method] ?? o.method : o.provider === 'BANK_TRANSFER' ? 'Bank transfer' : '—' }}</td>
            <td class="text-no-wrap">{{ money(o.amountMinor, o.currency) }}</td>
            <td><StatusPill :label="statusInfo[o.status].label" :tone="statusInfo[o.status].tone" /></td>
            <td class="text-no-wrap">
              <a v-if="o.receiptUrl" :href="o.receiptUrl" target="_blank" rel="noopener" class="link">View receipt</a>
              <router-link v-else-if="o.status === 'AWAITING_SLIP'" :to="`/checkout/bank-transfer/${o.id}`" class="link">Upload slip</router-link>
              <span v-else class="text-muted">{{ o.status === 'PENDING' ? 'Not ready yet' : 'Not available' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-body-2 text-muted ma-0">Receipts come from our payment provider, Stripe. Need a tax invoice? <router-link to="/messages" class="link">Contact us</router-link> with your order date and course name.</p>
  </div>
</template>

<style scoped>
.orders {
  max-width: 1000px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: var(--ot-control-h);
  font-size: var(--ot-fs-sm);
  color: var(--ot-muted);
  text-decoration: none;
  transition: color var(--ot-transition);
}
.back:hover {
  color: var(--ot-text);
  text-decoration: underline;
}
.table-wrap {
  overflow-x: auto;
}
.table-wrap table {
  min-width: 720px;
}
.course {
  color: var(--ot-text);
  text-decoration: none;
}
.link {
  color: var(--ot-accent-strong);
  font-weight: 500;
  text-decoration: none;
}
</style>
