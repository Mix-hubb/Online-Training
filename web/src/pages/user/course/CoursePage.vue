<script setup lang="ts">
// Course detail (spec 6.2): hero, intro video, outcomes, lessons, final test info, purchase card with states:
//   free -> Enrol; enrolled -> Continue; paid -> payment methods; pending bank slip -> continue transfer;
//   logged out -> Log in to enrol; partner -> no purchase.
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import LessonOutline from '@/components/course/LessonOutline.vue';
import PaymentMethodPicker from '@/components/course/PaymentMethodPicker.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import * as catalog from '@/api/catalog';
import * as learning from '@/api/learning';
import * as payments from '@/api/payments';
import { ApiError, errorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import type { CourseDetail, Currency, PayMethod } from '@/types';
import { duration, levelLabel, money, plural, priceLabel } from '@/utils/format';

const props = defineProps<{ slug?: string; preview?: boolean }>();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const course = ref<CourseDetail | null>(null);
const notFound = ref(false);
const method = ref<string | null>(null);
const busy = ref(false);
const err = ref('');
const introUrl = ref<string | null>(null);
const introOpen = ref(false);

async function load() {
  try {
    course.value = await catalog.getCourse(props.slug ?? String(route.params.slug));
    method.value = course.value.paymentMethods[0] ? `${course.value.paymentMethods[0].method}:${course.value.paymentMethods[0].currency}` : null;
  } catch {
    notFound.value = true;
  }
}
onMounted(load);

const enrolled = computed(() => !!course.value?.viewer?.enrolled);
const pending = computed(() => course.value?.viewer?.pendingOrder ?? null);
const isPartner = computed(() => auth.user?.role === 'PARTNER');
const continueTo = computed(() => {
  const c = course.value!;
  return `/learn/${c.slug}${c.viewer?.lastLessonId ? `?lesson=${c.viewer.lastLessonId}` : ''}`;
});

async function enrolFree() {
  if (props.preview) return;
  if (!auth.user) return router.push({ name: 'login', query: { next: route.fullPath } });
  busy.value = true;
  err.value = '';
  try {
    await learning.enroll(course.value!.id);
    await router.push(`/learn/${course.value!.slug}`);
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function buy() {
  if (props.preview) return;
  if (!auth.user) return router.push({ name: 'login', query: { next: route.fullPath } });
  if (!method.value) return;
  const [m, cur] = method.value.split(':') as [PayMethod, Currency];
  busy.value = true;
  err.value = '';
  try {
    if (m === 'bank') {
      const r = await payments.startBankTransfer(course.value!.id);
      await router.push(`/checkout/bank-transfer/${r.order.id}`);
    } else {
      const r = await payments.checkout(course.value!.id, m, cur);
      window.location.href = r.url;
    }
  } catch (e) {
    if (e instanceof ApiError && e.code === 'ALREADY_ENROLLED') await load();
    else err.value = e instanceof ApiError && e.code === 'PAYMENT_METHOD_UNAVAILABLE' ? 'This payment method is not available right now.' : errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function playIntro() {
  if (!introUrl.value) introUrl.value = (await catalog.introVideo(course.value!.slug)).url;
  introOpen.value = true;
}
</script>

<template>
  <div v-if="notFound" class="page"><EmptyState icon="mdi-book-off-outline" title="Course not found" text="It may have been removed or is not published yet." action-label="Browse courses" action-to="/" /></div>
  <div v-else-if="!course" class="page"><v-skeleton-loader type="heading, paragraph, image" color="surface" /></div>
  <div v-else class="page course">
    <nav aria-label="Breadcrumb" class="crumbs">
      <router-link to="/">Courses</router-link>
      <template v-if="course.category"><span aria-hidden="true">/</span><router-link :to="{ path: '/', query: { category: course.category.slug } }">{{ course.category.name }}</router-link></template>
      <span aria-hidden="true">/</span><span class="here">{{ course.title }}</span>
    </nav>

    <div class="layout">
      <div class="main-col">
        <header class="d-flex flex-column ga-3">
          <div class="d-flex flex-wrap ga-2">
            <span v-if="course.category" class="tag accent">{{ course.category.name }}</span>
            <span class="tag">{{ levelLabel[course.level] }}</span>
            <span v-for="t in course.tags" :key="t.id" class="tag">{{ t.name }}</span>
          </div>
          <h1 class="title">{{ course.title }}</h1>
          <p class="summary">{{ course.summary }}</p>
          <div class="text-body-2 text-muted d-flex flex-wrap ga-4">
            <span><v-icon icon="mdi-play-circle-outline" size="16" /> {{ plural(course.lessonCount, 'lesson') }}</span>
            <span><v-icon icon="mdi-clock-outline" size="16" /> {{ duration(course.durationSec) }}</span>
            <span v-if="course.quiz"><v-icon icon="mdi-checkbox-marked-outline" size="16" /> Final test + certificate</span>
          </div>
        </header>

        <div class="media">
          <img v-if="course.thumbnailUrl" :src="course.thumbnailUrl" alt="" />
          <button v-if="course.hasIntroVideo" type="button" class="play" aria-label="Play course introduction" @click="playIntro">
            <v-icon icon="mdi-play" size="32" />
          </button>
          <span v-if="course.hasIntroVideo" class="media-label">Course introduction</span>
        </div>

        <section v-if="course.outcomes.length" class="panel pad" aria-labelledby="learn-h">
          <h2 id="learn-h">What you will learn</h2>
          <div class="outcomes">
            <div v-for="(o, i) in course.outcomes" :key="i" class="d-flex ga-3 text-2">
              <v-icon icon="mdi-check" color="success" size="18" class="mt-1" />
              <span>{{ o }}</span>
            </div>
          </div>
        </section>

        <section v-if="course.description" class="panel pad" aria-labelledby="about-h">
          <h2 id="about-h">About this course</h2>
          <p class="text-body-2 text-2 mb-0" style="white-space: pre-line; line-height: 1.65">{{ course.description }}</p>
        </section>

        <section aria-labelledby="content-h" class="d-flex flex-column ga-3">
          <div class="d-flex flex-wrap justify-space-between align-baseline ga-2">
            <h2 id="content-h">Course content</h2>
            <span class="text-body-2 text-muted">{{ plural(course.lessonCount, 'video lesson') }}{{ course.quiz ? ' and a final test' : '' }}</span>
          </div>
          <LessonOutline :lessons="course.lessons" :enrolled="enrolled" :has-test="!!course.quiz" />
        </section>

        <section v-if="course.quiz" class="panel pad" aria-labelledby="test-h">
          <h2 id="test-h">About the final test</h2>
          <div class="facts">
            <div class="fact"><div class="fact-label">Questions</div><div class="fact-value">{{ course.quiz.questionCount }}</div></div>
            <div class="fact"><div class="fact-label">Pass mark</div><div class="fact-value">{{ course.quiz.passPercent }}%</div></div>
            <div class="fact"><div class="fact-label">Time limit</div><div class="fact-value">{{ course.quiz.timeLimitMin ? `${course.quiz.timeLimitMin} min` : 'None' }}</div></div>
            <div class="fact"><div class="fact-label">Attempts</div><div class="fact-value">{{ course.quiz.maxAttempts }}</div></div>
          </div>
          <p class="text-body-2 text-muted mb-0">Pass to get your certificate. If you use all attempts without passing, you restart the course lessons. Your purchase stays.</p>
        </section>
      </div>

      <aside class="buy panel" aria-label="Purchase">
        <div class="d-flex align-baseline flex-wrap ga-2">
          <span class="price">{{ course.isFree ? 'Free' : course.priceMinor > 0 ? money(course.priceMinor, 'usd') : priceLabel(course) }}</span>
          <span v-if="!course.isFree" class="text-body-2 text-muted">one-time, yours for good</span>
        </div>
        <span v-if="!course.isFree && course.priceMinor > 0 && course.priceThbMinor" class="text-body-2 text-muted mt-n2">Thai baht price: {{ money(course.priceThbMinor, 'thb') }}</span>
        <span v-if="course.instructors.length" class="text-body-2 text-muted">Taught by {{ course.instructors.map((i) => i.name).join(' and ') }}</span>
        <v-alert v-if="err" type="error" variant="tonal" density="compact">{{ err }}</v-alert>

        <template v-if="isPartner">
          <p class="text-body-2 text-muted mb-0">Partner accounts can view courses but cannot enrol.</p>
        </template>
        <template v-else-if="enrolled">
          <v-btn color="primary" block size="large" :to="continueTo">{{ course.viewer?.lastLessonId ? 'Continue' : 'Start learning' }}</v-btn>
          <span class="text-body-2 text-center" style="color: var(--ot-success)">{{ course.viewer?.enrollmentStatus === 'COMPLETED' ? 'You completed this course.' : 'You own this course.' }}</span>
        </template>
        <template v-else-if="pending && pending.status === 'AWAITING_SLIP'">
          <div class="callout">Your bank transfer is waiting for a slip or for review.</div>
          <v-btn color="primary" block size="large" :to="`/checkout/bank-transfer/${pending.id}`">View bank transfer</v-btn>
        </template>
        <template v-else-if="course.isFree">
          <v-btn color="primary" block size="large" :loading="busy" :disabled="preview" @click="enrolFree">{{ auth.user ? 'Start for free' : 'Log in to start' }}</v-btn>
        </template>
        <template v-else-if="!auth.user">
          <v-btn color="primary" block size="large" :to="{ name: 'login', query: { next: route.fullPath } }">Log in to buy</v-btn>
          <span class="text-body-2 text-muted text-center">New here? Sign up first, then pay once. Lifetime access and a certificate when you pass.</span>
        </template>
        <template v-else>
          <div class="text-body-2 font-weight-medium">Payment method</div>
          <PaymentMethodPicker v-model="method" :options="course.paymentMethods" />
          <v-btn color="primary" block size="large" :loading="busy" :disabled="!method || preview" @click="buy">Buy this course</v-btn>
          <span class="text-body-2 text-muted text-center">Card and PromptPay are processed by Stripe. You get access as soon as the payment is confirmed.</span>
        </template>

        <div v-if="!isPartner && auth.user && enrolled" class="d-flex flex-column ga-2">
          <v-btn variant="outlined" block prepend-icon="mdi-message-outline" :to="{ name: 'messages', query: { course: course.id } }">Ask the instructor</v-btn>
        </div>

        <ul class="perks">
          <li><v-icon icon="mdi-play-circle-outline" size="16" />{{ plural(course.lessonCount, 'video lesson') }}</li>
          <li v-if="course.quiz"><v-icon icon="mdi-checkbox-marked-outline" size="16" />Final test</li>
          <li v-if="course.quiz"><v-icon icon="mdi-certificate-outline" size="16" />Certificate when you pass</li>
          <li><v-icon icon="mdi-infinity" size="16" />Lifetime access</li>
        </ul>
      </aside>
    </div>

    <v-dialog v-model="introOpen" max-width="960">
      <v-card color="black">
        <video v-if="introUrl && introOpen" :src="introUrl" controls autoplay style="width: 100%; display: block" />
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.course {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.crumbs {
  font-size: 13px;
  color: var(--ot-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.crumbs a {
  color: var(--ot-muted);
  text-decoration: none;
}
.crumbs a:hover {
  color: var(--ot-text);
}
.crumbs .here {
  color: var(--ot-text);
}
.layout {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  align-items: flex-start;
}
.main-col {
  flex: 999 1 600px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.title {
  margin: 0;
  font-size: 36px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.summary {
  margin: 0;
  font-size: 16px;
  line-height: 1.65;
  color: var(--ot-muted);
  max-width: 680px;
}
h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.pad {
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.media {
  position: relative;
  aspect-ratio: 16 / 9;
  /* On very wide screens keep the cover from taking the whole viewport height. */
  max-height: 62vh;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-card);
  background: var(--ot-thumb);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.play {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 38px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--ot-accent);
  color: var(--ot-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--ot-shadow-card);
}
.media-label {
  position: absolute;
  left: 16px;
  bottom: 14px;
  font-size: 13px;
  color: var(--ot-muted);
  background: rgba(255, 255, 255, 0.92);
  padding: 5px 10px;
  border-radius: 3px;
}
.outcomes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px 28px;
  font-size: 14px;
  line-height: 1.5;
}
.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}
.buy {
  flex: 1 1 320px;
  max-width: 400px;
  position: sticky;
  top: 96px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.price {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.perks {
  list-style: none;
  margin: 0;
  padding: 18px 0 0;
  border-top: 1px solid var(--ot-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
  color: var(--ot-text-2);
}
.perks li {
  display: flex;
  align-items: center;
  gap: 10px;
}
.perks .v-icon {
  color: var(--ot-muted);
}
@media (max-width: 960px) {
  .buy {
    position: static;
    max-width: none;
  }
  .title {
    font-size: 28px;
  }
}
</style>
