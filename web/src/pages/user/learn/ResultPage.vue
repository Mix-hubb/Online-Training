<script setup lang="ts">
// Result (spec 6.5), four states: passed (+certificate, review), waiting for instructor,
// not passed (retry: review the lessons and try again any time). Using every attempt gives a new set of attempts;
// lesson progress is kept (changed 2026-11-26, no more restarting the lessons).
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import EmptyState from '@/components/common/EmptyState.vue';
import * as certApi from '@/api/certificates';
import * as learningApi from '@/api/learning';
import * as quizApi from '@/api/quiz';
import type { Attempt, QuizOverview } from '@/types';

const route = useRoute();
const router = useRouter();
const slug = String(route.params.slug);
const attempt = ref<Attempt | null>(null);
const ov = ref<QuizOverview | null>(null);
const cert = ref<{ id: string; number: string } | null>(null);
const failed = ref(false);

onMounted(async () => {
  try {
    const d = await learningApi.learn(slug);
    ov.value = await quizApi.overview(d.course.id);
    const id = String(route.params.attemptId ?? '') || ov.value.history[0]?.id;
    if (!id) return void router.replace(`/learn/${slug}/quiz`);
    attempt.value = await quizApi.attempt(id);
    if (attempt.value.status === 'IN_PROGRESS') return void router.replace(`/learn/${slug}/quiz`);
    if (attempt.value.passed) {
      const c = (await certApi.mine()).find((x) => x.course.slug === slug);
      if (c) cert.value = { id: c.id, number: c.number };
    }
  } catch {
    failed.value = true;
  }
});

const state = computed(() => {
  const a = attempt.value;
  if (!a || !ov.value) return null;
  if (a.status === 'PENDING_REVIEW') return 'pending';
  if (a.passed) return 'passed';
  return 'retry';
});
/** This was the last attempt of its round, so a new set of attempts started. */
const newRound = computed(() => !!attempt.value && !!ov.value && ov.value.cycle > attempt.value.cycle);
const tone = computed(() => ({ passed: 'success', pending: 'info', retry: 'warning' })[state.value ?? 'pending']);
const eyebrow = computed(() => ({ passed: 'Passed', pending: 'Waiting for grading', retry: 'Not passed yet' })[state.value ?? 'pending']);
const heading = computed(() => {
  if (state.value === 'passed') return 'You passed the final test';
  if (state.value === 'pending') return 'Your instructor is checking your answers';
  return `You need ${attempt.value?.passPercent ?? 0}% to pass`;
});
</script>

<template>
  <div class="page result">
    <EmptyState v-if="failed" class="panel" icon="mdi-alert-circle-outline" title="The result could not be loaded" action-label="Back to the course" :action-to="`/learn/${slug}`" />
    <v-skeleton-loader v-else-if="!state || !attempt" type="article" color="surface" />
    <template v-else>
      <section class="hero" :class="tone">
        <div v-if="state === 'passed'" class="confetti" aria-hidden="true">
          <i v-for="n in 18" :key="n" :style="{ '--i': n }" />
        </div>
        <div class="d-flex flex-wrap align-center ga-5">
          <div class="ring">
            <v-icon v-if="state === 'pending'" icon="mdi-account-clock-outline" size="36" />
            <template v-else>{{ attempt.percent ?? 0 }}%</template>
          </div>
          <div class="d-flex flex-column ga-1" style="flex: 1 1 260px">
            <span class="eyebrow">{{ eyebrow }}</span>
            <h1 class="htitle">{{ heading }}</h1>
            <p class="hsub">
              <template v-if="state === 'pending'">Your written answers are being checked. We will notify you when the result is ready.</template>
              <template v-else>
                Score {{ attempt.score }} of {{ attempt.maxScore }} points · Pass mark {{ attempt.passPercent }}%
                <template v-if="state === 'retry'"> · {{ ov!.attemptsLeft }} {{ ov!.attemptsLeft === 1 ? 'attempt' : 'attempts' }} left</template>
              </template>
            </p>
          </div>
        </div>
        <p v-if="state === 'retry'" class="hsub">
          <template v-if="newRound">You used all your attempts, so you have {{ ov!.maxAttempts }} new ones. </template>
          Your lessons are kept: rewatch any of them, then take the test again whenever you are ready. Correct answers stay hidden until you pass.
        </p>
        <div class="d-flex flex-wrap ga-3">
          <template v-if="state === 'passed'">
            <v-btn v-if="cert" color="primary" min-height="48" :to="`/certificates/${cert.number}`">View certificate</v-btn>
            <v-btn v-if="cert" variant="outlined" min-height="48" prepend-icon="mdi-download" @click="certApi.downloadPdf(cert.id, cert.number)">Download PDF</v-btn>
            <v-btn variant="outlined" min-height="48" prepend-icon="mdi-star-outline" :to="`/courses/${slug}#reviews`">Rate this course</v-btn>
            <v-btn variant="outlined" min-height="48" to="/profile">Back to my learning</v-btn>
          </template>
          <v-btn v-else-if="state === 'pending'" variant="outlined" min-height="48" :to="`/learn/${slug}`">Back to the course</v-btn>
          <template v-else-if="state === 'retry'">
            <v-btn color="primary" min-height="48" prepend-icon="mdi-play-circle-outline" :to="`/learn/${slug}`">Review lessons</v-btn>
            <v-btn variant="outlined" min-height="48" :to="`/learn/${slug}/quiz`">Take the test again ({{ ov!.attemptsLeft }} left)</v-btn>
          </template>
        </div>
      </section>

      <section v-if="attempt.review?.length" aria-labelledby="rev-h" class="d-flex flex-column ga-3">
        <h2 id="rev-h" class="section-title my-0">Review your answers</h2>
        <p class="text-body-2 text-muted ma-0">Correct answers are shown because you passed.</p>
        <div v-for="(r, i) in attempt.review" :key="r.id" class="panel pa-5 d-flex flex-column ga-2">
          <div class="d-flex justify-space-between ga-3 text-body-2">
            <span class="text-muted">Question {{ i + 1 }} · {{ r.type === 'MCQ' ? 'Multiple choice' : 'Written' }}</span>
            <span class="font-weight-bold" :style="{ color: r.type !== 'MCQ' ? 'var(--ot-accent-strong)' : r.isRight ? 'var(--ot-success)' : 'var(--ot-danger)' }">
              {{ r.type !== 'MCQ' ? `${r.pointsAwarded} of ${r.points} points` : r.isRight ? 'Correct' : 'Incorrect' }}
            </span>
          </div>
          <div class="qtext">{{ r.text }}</div>
          <template v-if="r.type === 'MCQ'">
            <div class="text-body-2 text-2">Your answer: {{ r.options?.find((o) => o.id === r.yourOptionId)?.text ?? '(no answer)' }}</div>
            <div class="text-body-2" style="color: var(--ot-success)">Correct answer: {{ r.options?.filter((o) => o.isCorrect).map((o) => o.text).join(', ') }}</div>
          </template>
          <template v-else>
            <div class="text-body-2 text-2" style="white-space: pre-line">{{ r.yourEssay || '(no answer)' }}</div>
            <div v-if="r.comment" class="callout">Instructor comment: {{ r.comment }}</div>
          </template>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.result {
  max-width: 860px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.hero {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--ot-info-border);
  background: var(--ot-info-bg);
  border-radius: var(--ot-radius-card);
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  --tone: var(--ot-accent);
}
.hero.success {
  border-color: var(--ot-success-border);
  background: var(--ot-success-bg);
  --tone: var(--ot-success);
}
.hero.warning {
  border-color: var(--ot-warning-border);
  background: var(--ot-warning-bg);
  --tone: var(--ot-warning);
}
.hero.danger {
  border-color: var(--ot-danger-border);
  background: var(--ot-danger-bg);
  --tone: var(--ot-danger);
}
/* A short burst of confetti on a pass; none when the device asks for less motion. */
.confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.confetti i {
  position: absolute;
  top: -12px;
  left: calc(var(--i) * 5.4%);
  width: 8px;
  height: 12px;
  border-radius: 2px;
  background: var(--ot-hl);
  opacity: 0;
  animation: drop 2.4s var(--ot-ease-out) calc(var(--i) * 60ms) 1 forwards;
}
.confetti i:nth-child(3n) {
  background: var(--ot-accent);
}
.confetti i:nth-child(3n + 1) {
  background: var(--ot-success);
  width: 6px;
}
.confetti i:nth-child(4n) {
  background: var(--ot-topic-3-fg);
  height: 8px;
}
@keyframes drop {
  0% {
    opacity: 1;
    transform: translateY(0) rotate(0);
  }
  100% {
    opacity: 0;
    transform: translateY(260px) rotate(540deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .confetti {
    display: none;
  }
}
.ring {
  width: 96px;
  height: 96px;
  border-radius: 48px;
  border: 4px solid var(--tone);
  color: var(--ot-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
  background: var(--ot-surface);
}
.ring .v-icon {
  color: var(--tone);
}
.eyebrow {
  align-self: flex-start;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--tone);
}
.htitle {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.hsub {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--ot-text-2);
}
.qtext {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.45;
}
</style>
