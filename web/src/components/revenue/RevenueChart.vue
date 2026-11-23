<script setup lang="ts">
// Revenue share over the selected period: one bar per day (per month when the period is longer than 62 days).
// One currency at a time (USD and THB are never added). Hover or keyboard (arrow keys) shows the value;
// "Show table" lists the same numbers.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { RevenueRow } from '@/types';
import { dayKey, monthKey, periodDays, type Period } from '@/utils/period';
import { money, plural } from '@/utils/format';

const props = defineProps<{ rows: RevenueRow[]; period: Period; loading?: boolean }>();

const CURRENCY_ORDER = ['usd', 'thb'];
const currencies = computed(() => {
  const set = new Set(props.rows.map((r) => r.currency));
  return [...CURRENCY_ORDER.filter((c) => set.has(c)), ...[...set].filter((c) => !CURRENCY_ORDER.includes(c)).sort()];
});
const currency = ref('usd');
watch(
  currencies,
  (list) => {
    if (list.length && !list.includes(currency.value)) currency.value = list[0];
  },
  { immediate: true },
);

interface Bucket {
  key: string;
  label: string; // tooltip / table label
  tick: string; // axis label
  amount: number; // minor units
  entries: number;
}
const fmtDay = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtTickDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const fmtMonth = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const fmtTickMonth = new Intl.DateTimeFormat('en-GB', { month: 'short' });

const monthly = computed(() => {
  const d = periodDays(props.period);
  return !!d && (d.end.getTime() - d.start.getTime()) / 86400000 > 62;
});

const buckets = computed<Bucket[]>(() => {
  const d = periodDays(props.period);
  if (!d) return [];
  const out: Bucket[] = [];
  const index = new Map<string, Bucket>();
  if (monthly.value) {
    for (let m = new Date(d.start.getFullYear(), d.start.getMonth(), 1); m <= d.end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      const b = { key: monthKey(m), label: fmtMonth.format(m), tick: fmtTickMonth.format(m), amount: 0, entries: 0 };
      out.push(b);
      index.set(b.key, b);
    }
  } else {
    for (let day = new Date(d.start); day <= d.end; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
      const b = { key: dayKey(day), label: fmtDay.format(day), tick: fmtTickDay.format(day), amount: 0, entries: 0 };
      out.push(b);
      index.set(b.key, b);
    }
  }
  for (const r of props.rows) {
    if (r.currency !== currency.value) continue;
    const at = new Date(r.date);
    const b = index.get(monthly.value ? monthKey(at) : dayKey(at));
    if (b) {
      b.amount += r.amountMinor;
      b.entries += 1;
    }
  }
  return out;
});
const total = computed(() => buckets.value.reduce((s, b) => s + b.amount, 0));
const withRevenue = computed(() => buckets.value.filter((b) => b.amount > 0));

// ---- geometry ----
const box = ref<HTMLElement | null>(null);
const width = ref(640);
const H = 240;
const M = { top: 16, right: 8, bottom: 30, left: 64 };
let ro: ResizeObserver | null = null;
onMounted(() => {
  ro = new ResizeObserver(([e]) => (width.value = Math.max(280, Math.round(e.contentRect.width))));
  if (box.value) ro.observe(box.value);
});
// The plot leaves the DOM while the table is shown: follow it when it comes back.
watch(box, (el, old) => {
  if (old) ro?.unobserve(old);
  if (el) ro?.observe(el);
});
onBeforeUnmount(() => ro?.disconnect());

const plotW = computed(() => width.value - M.left - M.right);
const plotH = H - M.top - M.bottom;

/** A round axis top: 1, 2, 2.5 or 5 times a power of ten, so 4 grid lines land on readable values. */
const yMax = computed(() => {
  const max = Math.max(0, ...buckets.value.map((b) => b.amount));
  if (!max) return 100;
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  return step * 4;
});
const compact = computed(() => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.value.toUpperCase(), notation: 'compact', maximumFractionDigits: 1 }));
const yTicks = computed(() => [0, 1, 2, 3, 4].map((i) => ({ v: (yMax.value / 4) * i, y: M.top + plotH - (plotH / 4) * i })));

const band = computed(() => plotW.value / Math.max(1, buckets.value.length));
const barW = computed(() => Math.max(2, Math.min(40, band.value - 2))); // 2px surface gap between bars
const tickEvery = computed(() => Math.max(1, Math.ceil(buckets.value.length / Math.max(2, Math.floor(plotW.value / 64)))));

const bars = computed(() =>
  buckets.value.map((b, i) => {
    const h = b.amount > 0 ? Math.max(2, (b.amount / yMax.value) * plotH) : 0;
    const cx = M.left + band.value * i + band.value / 2;
    const x = cx - barW.value / 2;
    const y = M.top + plotH - h;
    const r = Math.min(4, barW.value / 2, h);
    // Rounded top corners only; the bar sits flat on the baseline.
    const d = h ? `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + barW.value - r}Q${x + barW.value},${y} ${x + barW.value},${y + r}V${y + h}Z` : '';
    return { ...b, i, cx, x, y, h, d };
  }),
);

// ---- hover / keyboard ----
const active = ref<number | null>(null);
const activeBar = computed(() => (active.value === null ? null : bars.value[active.value] ?? null));
watch(buckets, () => (active.value = null));

function onMove(e: PointerEvent) {
  const svg = e.currentTarget as SVGSVGElement;
  const x = ((e.clientX - svg.getBoundingClientRect().left) / svg.getBoundingClientRect().width) * width.value;
  const i = Math.floor((x - M.left) / band.value);
  active.value = i >= 0 && i < buckets.value.length ? i : null;
}
function onKey(e: KeyboardEvent) {
  const n = buckets.value.length;
  if (!n) return;
  const cur = active.value ?? -1;
  const next = { ArrowRight: cur + 1, ArrowLeft: cur - 1, Home: 0, End: n - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  active.value = Math.min(n - 1, Math.max(0, next));
}
const tipStyle = computed(() => {
  const b = activeBar.value;
  if (!b) return {};
  const left = Math.min(Math.max(b.cx, 90), width.value - 90);
  return { left: `${left}px`, top: `${Math.max(0, (b.h ? b.y : M.top + plotH) - 8)}px` };
});

const showTable = ref(false);
</script>

<template>
  <section class="panel chart-card" aria-labelledby="rev-chart-h">
    <div class="d-flex flex-wrap align-center justify-space-between ga-3">
      <div class="d-flex flex-column">
        <h2 id="rev-chart-h" class="section-title my-0">{{ monthly ? 'Share per month' : 'Share per day' }}</h2>
        <span class="text-body-2 text-muted">
          Total {{ money(total, currency) }} · {{ plural(withRevenue.length, monthly ? 'month' : 'day') }} with revenue
        </span>
      </div>
      <div class="d-flex align-center flex-wrap ga-2">
        <div v-if="currencies.length > 1" class="chipbar" role="group" aria-label="Currency">
          <button v-for="c in currencies" :key="c" type="button" :aria-pressed="currency === c" @click="currency = c">{{ c.toUpperCase() }}</button>
        </div>
        <v-btn variant="text" size="small" :prepend-icon="showTable ? 'mdi-chart-bar' : 'mdi-table'" @click="showTable = !showTable">{{ showTable ? 'Show chart' : 'Show table' }}</v-btn>
      </div>
    </div>

    <div v-if="!currencies.length && !loading" class="empty text-body-2 text-muted">No revenue in this period.</div>

    <div v-else-if="!showTable" ref="box" class="plot" :class="{ dim: loading }">
      <svg
        :width="width"
        :height="H"
        :viewBox="`0 0 ${width} ${H}`"
        tabindex="0"
        role="img"
        :aria-label="`Bar chart of revenue share in ${currency.toUpperCase()}. Use the left and right arrow keys to read each ${monthly ? 'month' : 'day'}.`"
        @pointermove="onMove"
        @pointerleave="active = null"
        @keydown="onKey"
        @blur="active = null"
      >
        <!-- recessive grid + y labels -->
        <g aria-hidden="true">
          <template v-for="t in yTicks" :key="t.y">
            <line :x1="M.left" :x2="width - M.right" :y1="t.y" :y2="t.y" class="grid" :class="{ base: t.v === 0 }" />
            <text :x="M.left - 10" :y="t.y" class="ylab" text-anchor="end" dominant-baseline="middle">{{ compact.format(t.v / 100) }}</text>
          </template>
          <template v-for="b in bars" :key="`t-${b.key}`">
            <text v-if="b.i % tickEvery === 0" :x="b.cx" :y="H - 8" class="xlab" text-anchor="middle">{{ b.tick }}</text>
          </template>
        </g>
        <!-- hover column -->
        <rect v-if="activeBar" aria-hidden="true" :x="M.left + band * activeBar.i" :y="M.top" :width="band" :height="plotH" class="hover-col" />
        <g aria-hidden="true">
          <path v-for="b in bars" v-show="b.h" :key="b.key" :d="b.d" class="bar" :class="{ on: active === b.i }" />
        </g>
      </svg>
      <div v-if="activeBar" class="tip" :style="tipStyle" role="status">
        <strong>{{ money(activeBar.amount, currency) }}</strong>
        <span>{{ activeBar.label }}</span>
        <span>{{ activeBar.entries }} {{ activeBar.entries === 1 ? 'entry' : 'entries' }}</span>
      </div>
    </div>

    <div v-else class="table-scroll">
      <table class="data-table">
        <caption class="sr-only">Revenue share per {{ monthly ? 'month' : 'day' }} in {{ currency.toUpperCase() }}</caption>
        <thead>
          <tr><th scope="col">{{ monthly ? 'Month' : 'Day' }}</th><th scope="col" class="text-right">Entries</th><th scope="col" class="text-right">Share ({{ currency.toUpperCase() }})</th></tr>
        </thead>
        <tbody>
          <tr v-for="b in withRevenue" :key="b.key">
            <td>{{ b.label }}</td>
            <td class="text-right">{{ b.entries }}</td>
            <td class="text-right font-weight-medium">{{ money(b.amount, currency) }}</td>
          </tr>
          <tr v-if="!withRevenue.length"><td colspan="3" class="text-center text-muted">No revenue in this period.</td></tr>
        </tbody>
        <tfoot v-if="withRevenue.length">
          <tr><th scope="row">Total</th><td class="text-right">{{ withRevenue.reduce((s, b) => s + b.entries, 0) }}</td><td class="text-right font-weight-bold">{{ money(total, currency) }}</td></tr>
        </tfoot>
      </table>
    </div>
  </section>
</template>

<style scoped>
.chart-card {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.plot {
  position: relative;
  width: 100%;
  transition: opacity var(--ot-transition);
}
.plot.dim {
  opacity: 0.5;
}
svg {
  display: block;
  max-width: 100%;
  touch-action: pan-y;
}
svg:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: 4px;
  border-radius: var(--ot-radius-control);
}
.grid {
  stroke: var(--ot-border);
  stroke-width: 1;
  stroke-dasharray: 2 4;
}
.grid.base {
  stroke: var(--ot-input-border);
  stroke-dasharray: none;
}
.ylab,
.xlab {
  font-size: 12px;
  fill: var(--ot-muted);
  font-variant-numeric: tabular-nums;
}
.bar {
  fill: var(--ot-accent);
  transition: fill var(--ot-transition);
}
.bar.on {
  fill: var(--ot-accent-strong);
}
.hover-col {
  fill: var(--ot-accent);
  opacity: 0.07;
}
.tip {
  position: absolute;
  transform: translate(-50%, -100%);
  pointer-events: none;
  padding: 8px 12px;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-control);
  background: var(--ot-surface);
  box-shadow: var(--ot-shadow-card);
  display: flex;
  flex-direction: column;
  gap: 2px;
  white-space: nowrap;
  font-size: 12px;
  color: var(--ot-muted);
}
.tip strong {
  font-size: 15px;
  color: var(--ot-text);
  font-variant-numeric: tabular-nums;
}
.empty {
  padding: 40px 0;
  text-align: center;
}
@media (max-width: 600px) {
  .chart-card {
    padding: 16px;
  }
}
</style>
