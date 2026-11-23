<script setup lang="ts">
// Admin review stats: average, counts, star breakdown and per-course ratings.
// Clicking a star row, a course or "Hidden" sets the list filter below.
import { computed } from 'vue';
import StarRating from '@/components/review/StarRating.vue';
import type { ReviewStats } from '@/api/admin/reviews';

const props = defineProps<{ stats: ReviewStats; rating: string; courseTitle?: string }>();
const emit = defineEmits<{ rating: [value: string]; course: [id: string]; hidden: [] }>();

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const fmtAvg = (a: number | null) => (a === null ? '–' : a.toFixed(1));
const rows = computed(() =>
  ([5, 4, 3, 2, 1] as const).map((n) => {
    const c = props.stats.distribution[n];
    return { n, count: c, pct: props.stats.count ? Math.round((c / props.stats.count) * 100) : 0 };
  }),
);
const max = computed(() => Math.max(1, ...rows.value.map((r) => r.count)));
</script>

<template>
  <section class="d-flex flex-column ga-4" :aria-label="courseTitle ? `Review stats for ${courseTitle}` : 'Review stats'">
    <div class="tiles">
      <div class="stat panel">
        <span class="stat-label">Average rating</span>
        <span class="d-flex align-center ga-2">
          <span class="stat-value">{{ fmtAvg(stats.average) }}</span>
          <StarRating :value="stats.average" :size="20" />
        </span>
        <span class="stat-note">{{ courseTitle ? courseTitle : 'All courses' }}, shown reviews</span>
      </div>
      <div class="stat panel">
        <span class="stat-label">Shown reviews</span>
        <span class="stat-value">{{ stats.count }}</span>
        <span class="stat-note">Count towards the course rating</span>
      </div>
      <div class="stat panel">
        <span class="stat-label">Last 30 days</span>
        <span class="stat-value">{{ stats.last30Days.count }}</span>
        <span class="stat-note">{{ stats.last30Days.count ? `Average ${fmtAvg(stats.last30Days.average)} stars` : 'No new reviews' }}</span>
      </div>
      <button type="button" class="stat panel tile-btn" :disabled="!stats.hidden" @click="emit('hidden')">
        <span class="stat-label">Hidden</span>
        <span class="stat-value">{{ stats.hidden }}</span>
        <span class="stat-note">{{ stats.hidden ? 'Show only hidden reviews' : 'Nothing hidden' }}</span>
      </button>
    </div>

    <div class="grid" :class="{ single: !stats.byCourse.length }">
      <div class="panel pa-5 d-flex flex-column ga-3">
        <h2 class="ptitle">Star breakdown</h2>
        <ul class="bars">
          <li v-for="r in rows" :key="r.n">
            <button
              type="button"
              class="bar-row"
              :aria-pressed="rating === String(r.n)"
              :aria-label="`${r.n} stars: ${plural(r.count, 'review', 'reviews')}, ${r.pct}%. ${rating === String(r.n) ? 'Clear filter' : 'Show only these'}`"
              @click="emit('rating', rating === String(r.n) ? '' : String(r.n))"
            >
              <span class="lbl">{{ r.n }} <v-icon icon="mdi-star" size="14" class="star" aria-hidden="true" /></span>
              <span class="track"><span class="fill" :style="{ width: `${(r.count / max) * 100}%` }" /></span>
              <span class="num">{{ r.count }}</span>
              <span class="pct">{{ r.pct }}%</span>
            </button>
          </li>
        </ul>
        <p class="text-caption text-muted ma-0">Click a row to list only those reviews.</p>
      </div>

      <div v-if="stats.byCourse.length" class="panel pa-5 d-flex flex-column ga-3">
        <h2 class="ptitle">By course</h2>
        <div class="table-scroll">
          <table class="data-table compact">
            <caption class="sr-only">Rating by course</caption>
            <thead>
              <tr>
                <th scope="col">Course</th>
                <th scope="col">Rating</th>
                <th scope="col" class="text-right">Shown</th>
                <th scope="col" class="text-right">Hidden</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in stats.byCourse" :key="c.courseId">
                <td><button type="button" class="row-link text-left" @click="emit('course', c.courseId)">{{ c.title }}</button></td>
                <td class="text-no-wrap">
                  <span class="d-inline-flex align-center ga-2"><StarRating :value="c.average" :size="14" /><span class="font-weight-medium">{{ fmtAvg(c.average) }}</span></span>
                </td>
                <td class="text-right">{{ c.count }}</td>
                <td class="text-right" :class="{ 'text-muted': !c.hidden }">{{ c.hidden }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.tile-btn {
  border: 0;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.tile-btn:disabled {
  cursor: default;
}
.tile-btn:not(:disabled):hover {
  background: var(--ot-raised);
}
.tile-btn:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: 2px;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 16px;
}
.grid.single {
  grid-template-columns: minmax(0, 1fr);
}
.ptitle {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.bar-row {
  width: 100%;
  min-height: 44px;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 40px 44px;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--ot-radius-control);
  background: transparent;
  color: var(--ot-text);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.bar-row:hover {
  background: var(--ot-raised);
}
.bar-row[aria-pressed='true'] {
  background: var(--ot-raised);
  box-shadow: inset 0 0 0 1px var(--ot-accent);
}
.bar-row:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: 2px;
}
.lbl {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}
.star {
  color: var(--ot-star);
}
.track {
  height: 10px;
  border-radius: 999px;
  background: var(--ot-border);
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--ot-star);
  transition: width 0.3s ease;
}
.num {
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.pct {
  text-align: right;
  color: var(--ot-muted);
  font-variant-numeric: tabular-nums;
}
.compact :deep(td),
.compact :deep(th) {
  padding-top: 10px;
  padding-bottom: 10px;
}
@media (max-width: 1100px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 900px) {
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .tiles {
    gap: 12px;
  }
  .tiles .stat {
    padding: 18px 14px 14px;
  }
}
</style>
