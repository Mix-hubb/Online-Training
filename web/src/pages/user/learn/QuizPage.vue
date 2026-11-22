<script setup lang="ts">
// Final test (spec 6.4): intro -> attempt (timer, autosave, navigator) -> submit -> result.
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import * as learningApi from '@/api/learning';
import * as quizApi from '@/api/quiz';
import { ApiError, errorMessage } from '@/api/client';
import { useQuizTimer } from '@/composables/useQuizTimer';
import type { AnswerInput, Attempt, QuizOverview } from '@/types';
import { clock, date } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const slug = String(route.params.slug);
const courseId = ref('');
const courseTitle = ref('');
const ov = ref<QuizOverview | null>(null);
const attempt = ref<Attempt | null>(null);
const answers = ref<Record<string, AnswerInput>>({});
const idx = ref(0);
const err = ref('');
const busy = ref(false);
const confirm = ref(false);
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
const failedLoad = ref(false);

const deadline = computed(() => attempt.value?.deadline ?? null);
const { remaining, low } = useQuizTimer(deadline, () => void submit(true));
const questions = computed(() => attempt.value?.questions ?? []);
const q = computed(() => questions.value[idx.value]);
const answered = (id: string) => {
  const a = answers.value[id];
  return !!(a && (a.optionId || a.essayText?.trim()));
};
const unanswered = computed(() => questions.value.filter((x) => !answered(x.id)).length);

function goResult(id: string) {
  void router.replace(`/learn/${slug}/result/${id}`);
}

function setAttempt(a: Attempt) {
  attempt.value = a;
  const map: Record<string, AnswerInput> = {};
  for (const x of a.questions ?? []) map[x.id] = { questionId: x.id, optionId: null, essayText: null };
  for (const x of a.answers ?? []) map[x.questionId] = { questionId: x.questionId, optionId: x.optionId, essayText: x.essayText };
  answers.value = map;
}

onMounted(async () => {
  try {
    const d = await learningApi.learn(slug);
    courseId.value = d.course.id;
    courseTitle.value = d.course.title;
    ov.value = await quizApi.overview(d.course.id);
    if (ov.value.passed && ov.value.history[0]) return goResult(ov.value.history[0].id);
    if (ov.value.openAttemptId) {
      const a = await quizApi.attempt(ov.value.openAttemptId);
      if (a.status !== 'IN_PROGRESS') return goResult(a.id);
      setAttempt(a);
    }
  } catch (e) {
    if (e instanceof ApiError && e.code === 'NOT_ENROLLED') return void router.replace(`/courses/${slug}`);
    failedLoad.value = true;
  }
});

async function start() {
  busy.value = true;
  err.value = '';
  try {
    setAttempt(await quizApi.start(courseId.value));
    idx.value = 0;
  } catch (e) {
    err.value = e instanceof ApiError && e.code === 'NO_ATTEMPTS_LEFT' ? 'No attempts left.' : errorMessage(e);
  } finally {
    busy.value = false;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  answers,
  () => {
    if (!attempt.value || attempt.value.status !== 'IN_PROGRESS') return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 1200);
  },
  { deep: true },
);
async function save() {
  if (!attempt.value) return;
  saveState.value = 'saving';
  try {
    await quizApi.save(attempt.value.id, Object.values(answers.value));
    saveState.value = 'saved';
  } catch (e) {
    if (e instanceof ApiError && e.code === 'ATTEMPT_EXPIRED') return goResult(attempt.value.id);
    saveState.value = 'error';
  }
}

async function submit(auto = false) {
  if (!attempt.value || busy.value) return;
  clearTimeout(saveTimer);
  busy.value = true;
  try {
    const r = await quizApi.submit(attempt.value.id, Object.values(answers.value));
    goResult(r.attempt.id);
  } catch (e) {
    if (e instanceof ApiError && (e.code === 'ATTEMPT_EXPIRED' || e.code === 'ATTEMPT_ALREADY_SUBMITTED')) return goResult(attempt.value.id);
    err.value = auto ? 'Time is up, but the answers could not be sent. Check your connection.' : errorMessage(e);
  } finally {
    busy.value = false;
    confirm.value = false;
  }
}
function pick(optionId: string) {
  answers.value[q.value!.id] = { questionId: q.value!.id, optionId, essayText: null };
}
function essay(text: string) {
  answers.value[q.value!.id] = { questionId: q.value!.id, optionId: null, essayText: text };
}
</script>

<template>
  <div class="page quiz">
    <EmptyState v-if="failedLoad" class="panel" icon="mdi-alert-circle-outline" title="The test could not be loaded" action-label="Back to the course" :action-to="`/learn/${slug}`" />
    <v-skeleton-loader v-else-if="!ov" type="article" color="surface" />

    <!-- In progress -->
    <template v-else-if="attempt && q">
      <div class="qbar panel">
        <div class="d-flex flex-column ga-1">
          <div class="text-caption text-muted">{{ courseTitle }}</div>
          <h1 class="qtitle">Final test</h1>
        </div>
        <div class="d-flex flex-wrap align-center ga-3">
          <span class="text-caption text-muted" aria-live="polite">{{ saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Not saved' : '' }}</span>
          <span class="chip">Pass mark {{ ov.passPercent }}%</span>
          <span v-if="remaining !== null" class="timer" :class="{ low }" role="timer" :aria-label="`Time left ${clock(remaining)}`"><v-icon icon="mdi-timer-outline" size="16" />{{ clock(remaining) }}</span>
        </div>
      </div>
      <div v-if="err" class="callout danger">{{ err }}</div>

      <div class="qgrid">
        <div class="qmain">
          <section class="panel qcard" :aria-labelledby="`q-${q.id}`">
            <div class="d-flex flex-wrap justify-space-between align-baseline ga-3">
              <span class="qnum">Question {{ idx + 1 }} · {{ q.type === 'MCQ' ? 'Choose one' : 'Written answer' }}</span>
              <span class="text-body-2 text-muted">{{ q.points }} {{ q.points === 1 ? 'point' : 'points' }}<template v-if="q.type !== 'MCQ'"> · graded by your instructor</template></span>
            </div>
            <h2 :id="`q-${q.id}`" class="qtext">{{ q.text }}</h2>
            <div v-if="q.type === 'MCQ'" role="radiogroup" :aria-labelledby="`q-${q.id}`" class="d-flex flex-column ga-3">
              <button
                v-for="o in q.options"
                :key="o.id"
                type="button"
                role="radio"
                class="opt"
                :class="{ on: answers[q.id]?.optionId === o.id }"
                :aria-checked="answers[q.id]?.optionId === o.id"
                @click="pick(o.id)"
              >
                <span class="ring"><span /></span>
                <span>{{ o.text }}</span>
              </button>
            </div>
            <template v-else>
              <label :for="`essay-${q.id}`" class="sr-only">Your answer</label>
              <textarea :id="`essay-${q.id}`" class="essay" rows="7" maxlength="5000" placeholder="Type your answer here" :value="answers[q.id]?.essayText ?? ''" @input="essay(($event.target as HTMLTextAreaElement).value)" />
              <div class="d-flex justify-space-between text-caption text-muted"><span>Your answer saves as you type.</span><span>{{ (answers[q.id]?.essayText ?? '').length }} / 5000 characters</span></div>
            </template>
          </section>

          <div class="d-flex flex-wrap align-center ga-3">
            <span class="text-body-2 text-muted flex-grow-1">{{ questions.length - unanswered }} of {{ questions.length }} answered</span>
            <v-btn variant="outlined" :disabled="idx === 0" prepend-icon="mdi-chevron-left" @click="idx--">Previous</v-btn>
            <v-btn v-if="idx < questions.length - 1" variant="outlined" append-icon="mdi-chevron-right" @click="idx++">Next</v-btn>
            <v-btn color="primary" min-height="50" class="px-7" @click="confirm = true">Submit test</v-btn>
          </div>
        </div>

        <aside class="panel qnav" aria-label="Question navigator">
          <div class="font-weight-bold">Questions</div>
          <div class="nav-grid">
            <button
              v-for="(x, i) in questions"
              :key="x.id"
              type="button"
              class="nbtn"
              :class="{ done: answered(x.id), cur: i === idx }"
              :aria-label="`Question ${i + 1}${answered(x.id) ? ', answered' : ''}`"
              :aria-current="i === idx ? 'step' : undefined"
              @click="idx = i"
            >
              {{ i + 1 }}
            </button>
          </div>
          <div class="d-flex flex-column ga-2 text-caption text-muted">
            <span class="d-flex align-center ga-2"><span class="key done" />Answered</span>
            <span class="d-flex align-center ga-2"><span class="key" />Not answered</span>
          </div>
        </aside>
      </div>
      <ConfirmDialog v-model="confirm" title="Submit the test?" confirm-label="Submit" :loading="busy" @confirm="submit()">
        <span v-if="unanswered">You have {{ unanswered }} unanswered {{ unanswered === 1 ? 'question' : 'questions' }}. </span>You cannot change answers after submitting.
      </ConfirmDialog>
    </template>

    <!-- States before an attempt -->
    <EmptyState v-else-if="!ov.unlocked" class="panel" icon="mdi-lock-outline" title="The final test is locked" text="Finish every lesson to open the test." action-label="Back to lessons" :action-to="`/learn/${slug}`" />
    <EmptyState v-else-if="ov.pendingReview" class="panel" icon="mdi-account-clock-outline" title="Waiting for the instructor" text="Your last attempt has written answers. You can take the test again after it is graded." action-label="See result" :action-to="`/learn/${slug}/result/${ov.history[0]?.id ?? ''}`" />
    <div v-else class="intro d-flex flex-column ga-5">
      <router-link :to="`/learn/${slug}`" class="back">← Back to lessons</router-link>
      <div>
        <h1 class="page-title mb-1">Final test</h1>
        <p class="page-sub">{{ courseTitle }}</p>
      </div>
      <div v-if="err" class="callout danger">{{ err }}</div>
      <section class="panel pa-6 d-flex flex-column ga-5">
        <div class="facts">
          <div class="fact"><span class="fact-label">Questions</span><span class="fact-value">{{ ov.questionCount }}</span></div>
          <div class="fact"><span class="fact-label">Pass mark</span><span class="fact-value">{{ ov.passPercent }}%</span></div>
          <div class="fact"><span class="fact-label">Time limit</span><span class="fact-value">{{ ov.timeLimitMin ? `${ov.timeLimitMin} min` : 'None' }}</span></div>
          <div class="fact"><span class="fact-label">Attempts left</span><span class="fact-value">{{ ov.attemptsLeft }} of {{ ov.maxAttempts }}</span></div>
        </div>
        <ul class="rules">
          <li>Your answers are saved as you go. If you close the page, you can come back to the same attempt.</li>
          <li v-if="ov.timeLimitMin">When the time runs out, the test is submitted with the answers saved so far.</li>
          <li>If you use every attempt without passing, the lessons restart and you get {{ ov.maxAttempts }} new attempts.</li>
        </ul>
        <div><v-btn color="primary" min-height="50" class="px-7" :loading="busy" :disabled="ov.attemptsLeft <= 0" @click="start">{{ ov.history.length ? 'Try again' : 'Start the test' }}</v-btn></div>
      </section>
      <section v-if="ov.history.length" class="d-flex flex-column ga-3">
        <h2 class="section-title my-0">Previous attempts</h2>
        <table class="data-table">
          <thead><tr><th>Date</th><th>Score</th><th>Result</th><th /></tr></thead>
          <tbody>
            <tr v-for="h in ov.history" :key="h.id">
              <td>{{ date(h.startedAt) }}</td>
              <td>{{ h.score !== null ? `${h.score}/${h.maxScore}` : '—' }}</td>
              <td>
                <span class="pill" :class="h.status === 'PENDING_REVIEW' ? 'warning' : h.passed ? 'success' : h.status === 'GRADED' ? 'danger' : 'neutral'">{{ h.status === 'PENDING_REVIEW' ? 'Waiting for instructor' : h.passed ? 'Passed' : h.status === 'GRADED' ? 'Not passed' : 'In progress' }}</span>
              </td>
              <td class="text-right"><v-btn size="small" variant="outlined" :to="`/learn/${slug}/result/${h.id}`">View</v-btn></td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<style scoped>
.quiz {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.qbar {
  position: sticky;
  top: 72px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  padding: 16px 20px;
}
.qtitle {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.chip {
  font-size: 13px;
  color: var(--ot-text-2);
  border: 1px solid var(--ot-input-border);
  border-radius: 4px;
  padding: 8px 12px;
}
.timer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  background: var(--ot-accent-tint);
  border: 1px solid var(--ot-info-border);
  color: var(--ot-text);
  border-radius: 4px;
  padding: 8px 14px;
}
.timer .v-icon {
  color: var(--ot-accent-strong);
}
.timer.low {
  background: var(--ot-danger-bg);
  border-color: var(--ot-danger-border);
  color: var(--ot-danger);
}
.timer.low .v-icon {
  color: var(--ot-danger);
}
.qgrid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;
}
.qmain {
  flex: 999 1 600px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.qcard {
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.qnum {
  font-size: 13px;
  font-weight: 600;
  color: var(--ot-accent-strong);
}
.qtext {
  margin: 0;
  font-size: 19px;
  line-height: 1.45;
  font-weight: 600;
  white-space: pre-line;
}
.opt {
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  width: 100%;
  padding: 14px 16px;
  border-radius: 4px;
  border: 1px solid var(--ot-input-border);
  background: transparent;
  color: var(--ot-text);
  font-size: 15px;
  cursor: pointer;
}
.opt .ring {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid #4a586a;
  display: flex;
  align-items: center;
  justify-content: center;
}
.opt .ring span {
  width: 10px;
  height: 10px;
  border-radius: 5px;
}
.opt.on {
  border-color: var(--ot-accent);
  background: var(--ot-info-bg);
}
.opt.on .ring {
  border-color: var(--ot-accent);
}
.opt.on .ring span {
  background: var(--ot-accent);
}
.opt:focus-visible,
.nbtn:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: 2px;
}
.essay {
  width: 100%;
  padding: 14px;
  border-radius: 4px;
  border: 1px solid var(--ot-input-border);
  background: var(--ot-surface);
  color: var(--ot-text);
  font-size: 15px;
  line-height: 1.6;
  resize: vertical;
}
.qnav {
  flex: 1 1 240px;
  max-width: 300px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 170px;
}
.nav-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.nbtn {
  height: 44px;
  border-radius: 4px;
  border: 1px solid var(--ot-input-border);
  background: transparent;
  color: var(--ot-muted);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.nbtn.done,
.key.done {
  border-color: var(--ot-info-border);
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
}
.nbtn.cur {
  border-color: var(--ot-accent);
  box-shadow: inset 0 0 0 1px var(--ot-accent);
}
.key {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid var(--ot-input-border);
}
.intro {
  max-width: 860px;
}
.back {
  color: var(--ot-accent-strong);
  text-decoration: none;
  font-size: 14px;
}
.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.rules {
  margin: 0;
  padding-left: 20px;
  color: var(--ot-text-2);
  font-size: 14px;
  line-height: 1.7;
}
@media (max-width: 900px) {
  .qnav {
    max-width: none;
    position: static;
  }
}
</style>
