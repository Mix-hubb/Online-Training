<script setup lang="ts">
// Stripe return (mockup "Payment return"): /checkout/return?session_id=...
// Polls the order until the webhook marks it PAID, then shows Success; FAILED shows Failed; slow = timeout notice.
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useOrderPolling } from '@/composables/useOrderPolling';

const route = useRoute();
const { order, state, start } = useOrderPolling();
const sessionId = String(route.query.session_id ?? '');

onMounted(() => {
  if (sessionId) start(sessionId);
  else state.value = 'failed';
});

const view = computed(() => {
  if (state.value === 'paid')
    return { tone: 'ok', icon: 'mdi-check', title: 'Payment received', body: 'Thank you. Your course is ready. A receipt is available on your orders page.' };
  if (state.value === 'failed')
    return { tone: 'fail', icon: 'mdi-alert-circle-outline', title: 'Payment did not go through', body: 'You were not charged. Try again, or choose another payment method.' };
  if (state.value === 'timeout')
    return { tone: 'wait', icon: 'mdi-clock-outline', title: 'Still confirming', body: 'This is taking longer than usual. You can leave this page: the course opens as soon as the payment is confirmed, and you will get a notification.' };
  return { tone: 'wait', icon: 'mdi-dots-horizontal', title: 'Confirming your payment', body: 'Please wait a moment. Do not close this page. This usually takes a few seconds.' };
});
</script>

<template>
  <div class="page narrow">
    <section class="box panel" aria-live="polite">
      <div class="ico" :class="view.tone"><v-icon :icon="view.icon" size="28" /></div>
      <h1>{{ view.title }}</h1>
      <p>{{ view.body }}</p>
      <div v-if="order?.course" class="text-body-2 text-2">{{ order.course.title }}</div>
      <v-progress-linear v-if="state === 'polling' || state === 'idle'" indeterminate color="primary" height="6" bg-color="border" bg-opacity="1" aria-label="Confirming" />
      <v-btn v-if="state === 'paid' && order?.course" color="primary" size="large" :to="`/learn/${order.course.slug}`">Start learning</v-btn>
      <div v-if="state === 'failed'" class="d-flex flex-wrap justify-center ga-3">
        <v-btn color="primary" size="large" :to="order?.course ? `/courses/${order.course.slug}` : '/'">Try again</v-btn>
        <v-btn variant="outlined" size="large" to="/profile/orders">My orders</v-btn>
      </div>
      <v-btn v-if="state === 'timeout'" variant="outlined" size="large" to="/profile/orders">My orders</v-btn>
    </section>
  </div>
</template>

<style scoped>
.box {
  margin-top: 32px;
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
}
.ico {
  width: 64px;
  height: 64px;
  border-radius: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ot-accent-tint);
  color: var(--ot-accent);
}
.ico.ok {
  background: var(--ot-success-bg);
  color: var(--ot-success);
}
.ico.fail {
  background: var(--ot-danger-bg);
  color: var(--ot-danger);
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--ot-muted);
  max-width: 460px;
}
</style>
