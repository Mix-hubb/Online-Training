<script setup lang="ts">
// Home: banners, continue learning, filters + course grid, partner logos (spec 6 + 15.6/15.8).
// Admin-pinned courses come first in the grid (server order); learners see no pinned label.
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import HeroBanner from '@/components/course/HeroBanner.vue';
import CourseCard from '@/components/course/CourseCard.vue';
import CourseCover from '@/components/course/CourseCover.vue';
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
const steps = [
  { icon: 'mdi-magnify', title: 'Pick a course', text: 'Free or paid. Pay once by card, PromptPay, bank transfer or Bitcoin.' },
  { icon: 'mdi-play-circle-outline', title: 'Watch the lessons', text: 'Short video lessons in order. Each one opens after you watch the one before.' },
  { icon: 'mdi-certificate-outline', title: 'Pass the test', text: 'Finish with a final test and get a certificate anyone can verify online.' },
];
function clear() {
  filters.value = { q: '', category: '', level: '', price: '', tag: '', page: 1 };
}
</script>

<template>
  <div class="page home">
    <HeroBanner :banners="landing?.banners ?? []" :texts="texts" />

    <section v-if="learner && cont.length" aria-labelledby="continue-h" class="d-flex flex-column ga-4">
      <div class="d-flex flex-column ga-1">
        <h2 id="continue-h" class="h2">Continue learning</h2>
      </div>
      <div class="row-wrap two">
        <router-link
          v-for="c in cont.slice(0, 4)"
          :key="c.enrollmentId"
          :to="`/learn/${c.course.slug}${c.lastLesson ? `?lesson=${c.lastLesson.id}` : ''}`"
          class="resume panel"
        >
          <span class="resume-thumb"><CourseCover :image-url="c.course.thumbnailUrl" :title="c.course.title" size="sm" /></span>
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
        <div class="d-flex flex-column ga-1">
          <h2 id="catalog-h" class="big">All courses</h2>
        </div>
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
          <CourseCard v-for="(c, k) in result.items" :key="c.id" v-reveal="(k % 3) * 60" :course="c" :cta="cardCta(c)" />
        </div>
        <nav v-if="result.pages > 1" aria-label="Pagination" class="pager">
          <button v-for="n in result.pages" :key="n" type="button" :class="{ on: n === (filters.page ?? 1) }" :aria-current="n === (filters.page ?? 1) ? 'page' : undefined" :aria-label="`Page ${n}`" @click="goPage(n)">{{ n }}</button>
        </nav>
      </template>
    </section>

    <section v-reveal class="how" aria-labelledby="how-h">
      <div class="how-head">
        <h2 id="how-h" class="big">From first lesson to certificate</h2>
      </div>
      <ol class="steps">
        <li v-for="(s, k) in steps" :key="s.title" class="step">
          <span class="step-num" aria-hidden="true">{{ k + 1 }}</span>
          <span class="icon-tile" :class="{ hl: k === 2 }"><v-icon :icon="s.icon" /></span>
          <h3>{{ s.title }}</h3>
          <p>{{ s.text }}</p>
        </li>
      </ol>
    </section>

    <section v-if="!auth.user || learner" v-reveal class="cta-band" aria-labelledby="cta-h">
      <div>
        <h2 id="cta-h">{{ auth.user ? 'Ready for the next lesson?' : 'Start with a free course today' }}</h2>
        <p>{{ auth.user ? 'Your progress is saved. Carry on from where you stopped.' : 'Create a free account in a minute. Pay only for the paid courses you choose.' }}</p>
      </div>
      <div class="d-flex flex-wrap ga-3">
        <router-link v-if="auth.user" to="/profile" class="band-btn primary">Go to My learning</router-link>
        <template v-else>
          <router-link to="/register" class="band-btn primary">Create free account</router-link>
          <router-link :to="{ path: '/', query: { price: 'free' } }" class="band-btn">See free courses</router-link>
        </template>
      </div>
    </section>

    <PartnerLogos v-if="landing?.partners.length && landing.sections.partners?.isVisible !== false" :partners="landing.partners" />
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
.sec-head {
  align-items: flex-end;
}
.sec-head h2,
.h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.big {
  margin: 0;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
/* How it works */
.how {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 40px;
  border-radius: var(--ot-radius-card);
  border: 1px solid var(--ot-border);
  background: var(--ot-wash-band);
}
.how-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  counter-reset: step;
}
.step {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  border-radius: var(--ot-radius-card);
  background: var(--ot-surface);
  border: 1px solid var(--ot-border);
  box-shadow: var(--ot-shadow-card);
}
.step-num {
  position: absolute;
  top: 14px;
  right: 18px;
  font-family: var(--ot-font-display);
  font-size: 40px;
  font-weight: 800;
  line-height: 1;
  color: var(--ot-accent-tint);
}
.step h3 {
  margin: 6px 0 0;
  font-size: 17px;
  font-weight: 700;
}
.step p {
  margin: 0;
  font-size: var(--ot-fs-base);
  line-height: 1.6;
  color: var(--ot-muted);
}
/* Closing call to action on navy */
.cta-band {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 40px 48px;
  border-radius: var(--ot-radius-card);
  background: var(--ot-navy);
  color: var(--ot-on-navy);
}
.cta-band::after {
  content: '';
  position: absolute;
  right: -80px;
  top: -120px;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245, 184, 61, 0.28) 0%, transparent 65%);
  pointer-events: none;
}
.cta-band > * {
  position: relative;
  z-index: 1;
}
.cta-band h2 {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--ot-surface);
}
.cta-band p {
  margin: 0;
  max-width: 560px;
  color: var(--ot-on-navy-muted);
}
.band-btn {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding: 0 22px;
  border-radius: var(--ot-radius-control);
  border: 1px solid var(--ot-on-navy-muted);
  color: var(--ot-surface);
  font-weight: 600;
  text-decoration: none;
  transition: background var(--ot-transition), transform var(--ot-transition);
}
.band-btn:hover {
  background: var(--ot-navy-2);
  transform: translateY(-1px);
}
.band-btn.primary {
  border-color: var(--ot-hl);
  background: var(--ot-hl);
  color: var(--ot-navy);
}
.band-btn.primary:hover {
  background: #ffc85c;
}
.band-btn:focus-visible {
  outline: 2px solid var(--ot-hl);
  outline-offset: 2px;
}
.row-wrap.two {
  grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
}
.resume-thumb {
  flex: none;
  border-radius: var(--ot-radius-control);
  background: var(--ot-thumb);
  overflow: hidden;
}
.resume-thumb {
  width: 120px;
  height: 72px;
  border: 1px solid var(--ot-border);
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
  border-radius: var(--ot-radius-pill);
  background: var(--ot-border);
  overflow: hidden;
}
.bar > span {
  display: block;
  height: 6px;
  background: linear-gradient(90deg, var(--ot-accent) 0%, var(--ot-topic-2-fg) 100%);
}
.resume-cta {
  flex: none;
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
  font-size: 14px;
  font-weight: 600;
  padding: 10px 16px;
  border-radius: var(--ot-radius-control);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
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
  border-radius: var(--ot-radius-control);
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
  .how {
    padding: 24px 16px;
  }
  .cta-band {
    padding: 28px 20px;
  }
  .big {
    font-size: 24px;
  }
}
</style>
