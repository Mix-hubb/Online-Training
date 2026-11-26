<script setup lang="ts">
// Bank transfer (spec 15.1): show account details, upload a slip (jpg/png/webp, 5 MB), see review status.
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import EmptyState from '@/components/common/EmptyState.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import * as ordersApi from '@/api/orders';
import * as payments from '@/api/payments';
import { errorMessage, fileToBase64 } from '@/api/client';
import type { BankDetails, Order, Slip } from '@/types';
import { dateTime, money } from '@/utils/format';
import CourseCover from '@/components/course/CourseCover.vue';

const route = useRoute();
const router = useRouter();
const askCancel = ref(false);
const cancelling = ref(false);
const id = String(route.params.orderId);
const order = ref<Order | null>(null);
const bank = ref<BankDetails | null>(null);
const slips = ref<Slip[]>([]);
const missing = ref(false);
const file = ref<File | null>(null);
const busy = ref(false);
const err = ref('');
const copied = ref(false);

async function load() {
  try {
    [order.value, bank.value, slips.value] = await Promise.all([ordersApi.order(id), payments.bankDetails(), payments.slips(id)]);
  } catch {
    missing.value = true;
  }
}
onMounted(load);
const pendingSlip = computed(() => slips.value.find((s) => s.status === 'PENDING'));
const lastRejected = computed(() => (slips.value[0]?.status === 'REJECTED' ? slips.value[0] : null));
const slipLabel: Record<Slip['status'], string> = { PENDING: 'Under review', APPROVED: 'Approved', REJECTED: 'Rejected' };
function pickFile(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null;
}

async function upload() {
  err.value = '';
  const f = file.value;
  if (!f) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return void (err.value = 'Use a JPG, PNG or WebP image.');
  if (f.size > 5 * 1024 * 1024) return void (err.value = 'The image must be 5 MB or smaller.');
  busy.value = true;
  try {
    await payments.uploadSlip(id, { name: f.name, dataBase64: await fileToBase64(f) });
    file.value = null;
    await load();
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
/** No slip under review yet: drop this transfer and go back to the course to pick another way to pay. */
async function cancelTransfer() {
  cancelling.value = true;
  err.value = '';
  try {
    await payments.cancelBankTransfer(id);
    askCancel.value = false;
    await router.push(order.value?.course?.slug ? `/courses/${order.value.course.slug}` : '/profile/orders');
  } catch (e) {
    askCancel.value = false;
    err.value = errorMessage(e);
  } finally {
    cancelling.value = false;
  }
}
async function copy(text: string) {
  await navigator.clipboard.writeText(text).catch(() => undefined);
  copied.value = true;
}
const tone = (s: Slip['status']) => (s === 'APPROVED' ? 'success' : s === 'REJECTED' ? 'danger' : 'warning');
</script>

<template>
  <div class="page bank">
    <EmptyState v-if="missing" class="panel" icon="mdi-receipt-text-remove-outline" title="Order not found" action-label="My orders" action-to="/profile/orders" />
    <v-skeleton-loader v-else-if="!order || !bank" type="article" color="surface" />
    <template v-else>
      <div>
        <h1 class="page-title mb-1">Checkout</h1>
        <p class="page-sub">Pay by bank transfer, then upload your slip.</p>
      </div>
      <div class="cols">
        <div class="main-col">
          <div v-if="order.status === 'PAID'" class="callout success">
            <span class="flex-grow-1"><strong>Payment approved.</strong> You can start the course now.</span>
            <v-btn color="primary" :to="`/learn/${order.course?.slug}`">Start learning</v-btn>
          </div>
          <div v-else-if="order.status === 'FAILED'" class="callout danger">This order was cancelled. Start a new purchase from the course page.</div>

          <section class="panel pa-6 d-flex flex-column ga-4" aria-labelledby="bk">
            <h2 id="bk" class="h2">Bank transfer</h2>
            <StatusPill class="align-self-start" :label="order.status === 'PAID' ? 'Status: paid' : pendingSlip ? 'Status: under review' : 'Status: awaiting slip'" :tone="order.status === 'PAID' ? 'success' : pendingSlip ? 'info' : 'warning'" />
            <p class="text-body-2 text-muted ma-0" style="line-height: 1.6">Transfer exactly the amount below, then upload your transfer slip. We confirm it within one business day and the course opens after approval.</p>
            <div v-if="bank.placeholder" class="callout warning">Bank details have not been set by the admin yet. Do not transfer until real details are shown.</div>
            <dl class="dl">
              <dt>Amount to transfer</dt>
              <dd class="font-weight-bold">{{ money(order.amountMinor, order.currency) }}</dd>
              <dt>Bank</dt>
              <dd>{{ bank.bankName }}</dd>
              <dt>Account name</dt>
              <dd>{{ bank.accountName }}</dd>
              <dt>Account number</dt>
              <dd class="mono d-flex align-center ga-1">{{ bank.accountNumber }}<v-btn size="x-small" variant="text" icon="mdi-content-copy" aria-label="Copy account number" @click="copy(bank.accountNumber)" /></dd>
              <dt>Reference</dt>
              <dd class="mono">{{ order.id.slice(-8).toUpperCase() }}</dd>
            </dl>
            <p v-if="bank.note" class="text-caption text-muted ma-0">{{ bank.note }}</p>
          </section>

          <section v-if="lastRejected && order.status === 'AWAITING_SLIP' && !pendingSlip" class="panel rejected pa-6 d-flex flex-column ga-2">
            <h2 class="h2" style="color: var(--ot-danger)">Slip rejected</h2>
            <p class="text-body-2 text-2 ma-0" style="line-height: 1.6"><strong>Reason from our team:</strong> {{ lastRejected.reason || 'No reason given.' }} Please upload a new slip.</p>
          </section>

          <section v-if="pendingSlip && order.status !== 'PAID'" class="panel pa-6 d-flex flex-column ga-3">
            <h2 class="h2">Slip received</h2>
            <p class="text-body-2 text-muted ma-0" style="line-height: 1.6">We are checking your payment. You will get a notification as soon as it is approved, usually within one business day. If the slip is rejected, you can upload a new one.</p>
            <router-link to="/profile/orders" class="link">Go to my orders</router-link>
          </section>
          <section v-else-if="order.status === 'AWAITING_SLIP'" class="panel pa-6 d-flex flex-column ga-4">
            <h2 class="h2">{{ lastRejected ? 'Upload a new slip' : 'Upload your transfer slip' }}</h2>
            <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
            <label class="drop" :class="{ has: file }">
              <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="pickFile" />
              <span class="font-weight-bold text-body-2">{{ file ? file.name : 'Choose your slip image' }}</span>
              <span class="text-caption text-muted">JPG, PNG or WebP, up to 5 MB</span>
              <span class="choose">Choose file</span>
            </label>
            <div class="d-flex flex-wrap ga-2 align-center">
              <v-btn color="primary" min-height="48" :loading="busy" :disabled="!file" @click="upload">Submit slip</v-btn>
              <v-btn variant="text" min-height="48" @click="askCancel = true">Cancel and choose another method</v-btn>
            </div>
          </section>

          <section v-if="slips.length" class="d-flex flex-column ga-3">
            <h2 class="section-title my-0">Uploaded slips</h2>
            <div v-for="s in slips" :key="s.id" class="panel pa-4 d-flex ga-4 align-center">
              <a :href="s.url" target="_blank" rel="noopener"><img :src="s.url" alt="Slip" class="slip-img" /></a>
              <div class="flex-grow-1">
                <div class="text-body-2">{{ dateTime(s.createdAt) }}</div>
                <div v-if="s.reason" class="text-caption" style="color: var(--ot-danger)">Reason: {{ s.reason }}</div>
              </div>
              <StatusPill :label="slipLabel[s.status]" :tone="tone(s.status)" />
            </div>
          </section>
        </div>

        <aside class="panel summary" aria-label="Order summary">
          <h2 class="h2">Order summary</h2>
          <div class="d-flex ga-3">
            <span class="sthumb"><CourseCover :image-url="order.course?.thumbnailUrl" :title="order.course?.title ?? ''" size="sm" /></span>
            <div class="text-body-2 font-weight-bold" style="line-height: 1.35">{{ order.course?.title }}</div>
          </div>
          <div class="total"><span>Total</span><span>{{ money(order.amountMinor, order.currency) }}</span></div>
          <p class="text-caption text-muted ma-0" style="line-height: 1.5">One-time payment. You keep the course for good.</p>
        </aside>
      </div>
      <v-snackbar v-model="copied" :timeout="2000">Copied</v-snackbar>
      <v-dialog v-model="askCancel" max-width="420">
        <v-card class="pa-2">
          <v-card-title class="text-h6">Cancel this bank transfer?</v-card-title>
          <v-card-text class="text-body-2">Only cancel if you have not transferred any money. You can then pay by card, PromptPay or a new bank transfer.</v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="askCancel = false">Keep it</v-btn>
            <v-btn color="primary" variant="flat" :loading="cancelling" @click="cancelTransfer">Cancel transfer</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>
  </div>
</template>

<style scoped>
.bank {
  max-width: 1100px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.cols {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;
}
.main-col {
  flex: 2 1 520px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.dl {
  margin: 0;
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 10px 16px;
  font-size: 14px;
}
.dl dt {
  color: var(--ot-muted);
}
.dl dd {
  margin: 0;
}
.rejected {
  border-color: var(--ot-danger-border);
}
.drop {
  border: 1px dashed var(--ot-input-border);
  border-radius: var(--ot-radius-card);
  padding: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  background: var(--ot-raised);
  cursor: pointer;
}
.drop.has {
  border-color: var(--ot-accent);
  background: var(--ot-info-bg);
}
.drop:focus-within {
  outline: 2px solid var(--ot-accent);
  outline-offset: 2px;
}
.choose {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid var(--ot-input-border);
  border-radius: var(--ot-radius-control);
  padding: 10px 16px;
  background: var(--ot-surface);
  box-shadow: var(--ot-shadow-btn);
}
.link {
  color: var(--ot-accent-strong);
  font-size: 14px;
}
.slip-img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: var(--ot-radius-control);
  display: block;
}
.summary {
  flex: 1 1 300px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 88px;
}
.sthumb {
  width: 88px;
  height: 56px;
  flex: none;
  border-radius: var(--ot-radius-control);
  background: var(--ot-thumb);
  overflow: hidden;
}
.sthumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.total {
  border-top: 1px solid var(--ot-border);
  padding-top: 14px;
  display: flex;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 600;
}
@media (max-width: 600px) {
  .dl {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .dl dd {
    margin-bottom: 8px;
  }
}
</style>
