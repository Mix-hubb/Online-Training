<script setup lang="ts">
// Payment method list (spec 15.1): card (USD/THB), PromptPay (THB), bank transfer (THB), Bitcoin (shown as unavailable).
import { computed } from 'vue';
import type { MethodOption } from '@/types';
import { methodLabel, money } from '@/utils/format';

const props = defineProps<{ options: MethodOption[] }>();
const model = defineModel<string | null>({ default: null });
const hint: Record<string, string> = {
  card: 'Visa, Mastercard and others via Stripe',
  promptpay: 'Scan a QR code with a Thai banking app',
  bank: 'Transfer, then upload your slip for review',
};
const items = computed(() => props.options.map((o) => ({ ...o, key: `${o.method}:${o.currency}` })));
const hasBtc = computed(() => props.options.some((o) => o.method === 'btc'));
</script>

<template>
  <div role="radiogroup" aria-label="Payment method" class="d-flex flex-column ga-2">
    <button
      v-for="o in items"
      :key="o.key"
      type="button"
      role="radio"
      class="method"
      :class="{ on: model === o.key }"
      :aria-checked="model === o.key"
      @click="model = o.key"
    >
      <span class="dot" aria-hidden="true" />
      <span class="flex-grow-1 d-flex flex-column ga-1" style="min-width: 0">
        <span class="label">{{ methodLabel[o.method] }} <span class="text-muted font-weight-regular">· {{ o.currency.toUpperCase() }}</span></span>
        <span class="note">{{ hint[o.method] }}</span>
      </span>
      <span class="amount">{{ money(o.amountMinor, o.currency) }}</span>
    </button>
    <div v-if="!hasBtc" class="method disabled" aria-disabled="true">
      <span class="dot" aria-hidden="true" />
      <span class="flex-grow-1 d-flex flex-column ga-1">
        <span class="label text-muted">Bitcoin</span>
        <span class="note">Not available yet</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.method {
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: var(--ot-text);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: var(--ot-radius-control);
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
}
.method:hover:not(.disabled) {
  border-color: var(--ot-info-border);
}
.method.on {
  border-color: var(--ot-accent);
  background: var(--ot-info-bg);
}
.method:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: 2px;
}
.dot {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 9px;
  border: 2px solid var(--ot-text-2);
  background: var(--ot-surface);
}
.method.on .dot {
  border-color: var(--ot-accent);
  box-shadow: inset 0 0 0 3px var(--ot-surface);
  background: var(--ot-accent);
}
.label {
  font-size: 14px;
  font-weight: 600;
}
.note {
  font-size: 12px;
  color: var(--ot-muted);
  line-height: 1.4;
}
.amount {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}
.method.disabled {
  cursor: not-allowed;
  opacity: 0.6;
  background: var(--ot-raised);
}
</style>
