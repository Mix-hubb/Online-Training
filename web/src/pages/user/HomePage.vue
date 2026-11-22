<script setup lang="ts">
// Home: banners, continue learning, filters + course grid, partner logos (spec 6 + 15.6/15.8).
// Admin-pinned courses come first in the grid (server order); learners see no pinned label.
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import HeroBanner from '@/components/course/HeroBanner.vue';
import CourseCard from '@/components/course/CourseCard.vue';
import CourseFilters from '@/components/course/CourseFilters.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import PartnerLogos from '@/components/common/PartnerLogos.vue';
import * as catalog from '@/api/catalog';
import * as learning from '@/api/learning';
import { useAuthStore } from '@/stores/auth';
import { useLanding } from '@/composables/useLanding';
import type { CourseCard as Card, MyCourse, Paged, Taxon } from '@/types';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { landing, load } = useLanding();

const filters = ref<catalog.CourseQuery>({
  q: String(route.query.q ?? ''),
  category: String(route.query.category ?? ''),
  level: String(route.query.level ?? ''),
  price: (route.query.price as 'free' | 'paid' | '') ?? '',
  tag: String(route.query.tag ?? ''),
  page: Number(route.query.page ?? 1),
});
const result = ref<Paged<Card> | null>(null);
const loading = ref(true);
const failed = ref(false);
const categories = ref<Taxon[]>([]);
const tags = ref<Taxon[]>([]);
const cont = ref<MyCourse[]>([]);
const mine = ref<MyCourse[]>([]);
const mineById = computed(() => new Map(mine.value.map((m) => [m.course.id, m])));
const learner = computed(() => !!auth.user && auth.user.role !== 'PARTNER');
const texts = computed(() => (landing.value?.sections.hero?.content ?? {}) as Record<string, string>);

let t: ReturnType<typeof setTimeout> | undefined;
async function fetchCourses() {
  loading.value = true;
  failed.value = false;
  try {
    result.value = await catalog.listCourses({ ...filters.value, pageSize: 12 });
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
watch(
  filters,
  (f) => {
    clearTimeout(t);
    t = setTimeout(() => {
      void router.replace({ query: Object.fromEntries(Object.entries(f).filter(([, v]) => v && v !== 1)) });
      void fetchCourses();
    }, 250);
  },
  { deep: true },
);

onMounted(async () => {
  void load();
  void fetchCourses();
  catalog.categories().then((c) => (categories.value = c)).catch(() => undefined);
  catalog.tags().then((x) => (tags.value = x)).catch(() => undefined);
  if (learner.value) {
    learning.myCourses().then((m) => (mine.value = m)).catch(() => undefined);
    cont.value = await learning.continueLearning().catch(() => []);
  }
});
const hasFilters = computed(() => !!(filters.value.q || filters.value.category || filters.value.level || filters.value.price || filters.value.tag));
const cardCta = (c: Card) => (mineById.value.has(c.id) ? 'Enrolled' : c.isFree ? 'Start free' : 'View course');
const nextLabel = (c: MyCourse) => c.lastLesson?.title ?? 'First lesson';
function goPage(n: number) {
  filters.value = { ...filters.value, page: n };
  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function clear() {
  filters.value = { q: '', category: '', level: '', price: '', tag: '', page: 1 };
}
</script>

<template>
  <div class="page home">
    <HeroBanner :banners="landing?.banners ?? []" :texts="texts" />

    <PartnerLogos v-if="landing?.partners.length && landing.sections.partners?.isVisible !== false" :partners="landing.partners" />

    <section v-if="learner && cont.length" aria-labelledby="continue-h" class="d-flex flex-column ga-4">
      <h2 id="continue-h" class="h2">Continue learning</h2>
      <div class="row-wrap two">
        <router-link
          v-for="c in cont.slice(0, 4)"
          :key="c.enrollmentId"
          :to="`/learn/${c.course.slug}${c.lastLesson ? `?lesson=${c.lastLesson.id}` : ''}`"
          class="resume panel"
        >
          <span class="resume-thumb"><img v-if="c.course.thumbnailUrl" :src="c.course.thumbnailUrl" alt="" /></span>
          <span class="flex-grow-1 d-flex flex-column ga-2" style="min-width: 0">
            <span class="resume-title">{{ c.course.title }}</span>
            <span class="text-body-2 text-muted">Next: {{ nextLabel(c) }}</span>
            <span class="d-flex align-center ga-3">
              <span class="bar" role="progressbar" :aria-label="`${c.course.title} progress`" :aria-valuenow="c.percent" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${c.percent}%` }" /></span>
              <span class="text-caption text-muted">{{ c.percent }}%</span>
            </span>
          </span>
          <span class="resume-cta">Resume</span>
        </router-link>
      </div>
    </section>

    <section id="catalog" aria-labelledby="catalog-h" class="d-flex flex-column ga-5">
      <div class="sec-head">
        <h2 id="catalog-h" class="big">All courses</h2>
        <span v-if="result" class="text-body-2 text-muted">Showing {{ result.items.length }} of {{ result.total }} {{ result.total === 1 ? 'course' : 'courses' }}</span>
      </div>
      <CourseFilters v-model="filters" :categories="categories" :tags="tags" />

      <div v-if="loading && !result" class="grid">
        <v-skeleton-loader v-for="i in 6" :key="i" type="image, article" color="surface" class="panel" />
      </div>
      <EmptyState v-else-if="failed" icon="mdi-cloud-alert-outline" title="Courses could not be loaded" text="Check your connection and try again." action-label="Try again" @action="fetchCourses" />
      <EmptyState v-else-if="result && !result.items.length" class="panel" icon="mdi-magnify-close" :title="hasFilters ? 'No courses match your filters' : 'No courses yet'" :text="hasFilters ? 'Try a different search or clear the filters.' : 'New courses will appear here.'">
        <v-btn v-if="hasFilters" variant="outlined" @click="clear">Clear filters</v-btn>
      </EmptyState>
      <template v-else-if="result">
        <div class="grid">
          <CourseCard v-for="c in result.items" :key="c.id" :course="c" :cta="cardCta(c)" />
        </div>
        <nav v-if="result.pages > 1" aria-label="Pagination" class="pager">
          <button v-for="n in result.pages" :key="n" type="button" :class="{ on: n === (filters.page ?? 1) }" :aria-current="n === (filters.page ?? 1) ? 'page' : undefined" :aria-label="`Page ${n}`" @click="goPage(n)">{{ n }}</button>
        </nav>
      </template>
    </section>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 48px;
}
.sec-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.sec-head h2,
.h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.sec-head h2.big {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.row-wrap.two {
  grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
}
.resume-thumb {
  flex: none;
  border-radius: 4px;
  background: var(--ot-thumb);
  overflow: hidden;
}
.resume-thumb {
  width: 120px;
  height: 72px;
}
.resume-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.resume {
  min-width: 0;
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 16px;
  text-decoration: none;
  color: var(--ot-text);
}
.resume:hover {
  border-color: var(--ot-info-border);
}
.resume-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}
.bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--ot-border);
  overflow: hidden;
}
.bar > span {
  display: block;
  height: 6px;
  background: var(--ot-accent);
}
.resume-cta {
  flex: none;
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
  font-size: 14px;
  font-weight: 600;
  padding: 10px 16px;
  border-radius: 4px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
  margin-top: 4px;
}
.pager {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}
.pager button {
  min-width: 44px;
  height: 44px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  color: var(--ot-muted);
  font-size: 14px;
  cursor: pointer;
}
.pager button.on {
  border-color: var(--ot-accent-tint);
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
  font-weight: 600;
}
.pager button:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: 2px;
}
@media (max-width: 600px) {
  .home {
    gap: 32px;
  }
  .resume-thumb {
    display: none;
  }
  .row-wrap.two {
    grid-template-columns: 1fr;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
