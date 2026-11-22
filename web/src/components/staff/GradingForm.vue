<script setup lang="ts">
// Grade essay answers (0..points + comment). MCQ answers are shown already scored.
import { computed, ref, watch } from 'vue';
import type { GradingAttempt } from '@/api/admin/grading';
import { dateTime } from '@/utils/format';

const props = defineProps<{ attempt: GradingAttempt; saving?: boolean; readonly?: boolean }>();
const emit = defineEmits<{ save: [{ questionId: string; points: number; comment?: string }[]] }>();
const grades = ref<Record<string, { points: number; comment: string }>>({});
watch(
  () => props.attempt,
  (a) => {
    const g: Record<string, { points: number; comment: string }> = {};
    for (const q of a.quiz.questions.filter((x) => x.type === 'ESSAY')) {
      const ans = a.answers.find((x) => x.questionId === q.id);
      g[q.id] = { points: ans?.pointsAwarded ?? 0, comment: ans?.adminComment ?? '' };
    }
    grades.value = g;
  },
  { immediate: true },
);
const answerOf = (id: string) => props.attempt.answers.find((a) => a.questionId === id);
const mcqScore = computed(() =>
  props.attempt.quiz.questions.filter((q) => q.type === 'MCQ').reduce((s, q) => s + (q.options.find((o) => o.id === answerOf(q.id)?.optionId)?.isCorrect ? q.points : 0), 0),
);
const mcqMax = computed(() => props.attempt.quiz.questions.filter((q) => q.type === 'MCQ').reduce((s, q) => s + q.points, 0));
const essayCount = computed(() => props.attempt.quiz.questions.filter((q) => q.type === 'ESSAY').length);
const validPts = (id: string, maxPts: number) => {
  const p = Number(grades.value[id]?.points);
  return Number.isFinite(p) && p >= 0 && p <= maxPts;
};
const allValid = computed(() => props.attempt.quiz.questions.filter((q) => q.type === 'ESSAY').every((q) => validPts(q.id, q.points)));
const max = computed(() => props.attempt.quiz.questions.reduce((s, q) => s + q.points, 0));
const total = computed(() => mcqScore.value + Object.values(grades.value).reduce((s, g) => s + (Number(g.points) || 0), 0));
const passes = computed(() => total.value * 100 >= props.attempt.quiz.passPercent * max.value);
function save() {
  emit('save', Object.entries(grades.value).map(([questionId, g]) => ({ questionId, points: Number(g.points) || 0, comment: g.comment || undefined })));
}
</script>

<template>
  <section class="gform" aria-label="Answers to grade">
    <div class="panel pa-6 d-flex flex-wrap justify-space-between ga-4">
      <div style="min-width: 0">
        <div class="gname">{{ attempt.enrollment.user.name }}</div>
        <div class="text-body-2 text-muted mt-1">{{ attempt.enrollment.user.email }} · {{ attempt.quiz.course.title }}</div>
        <div class="text-caption text-muted mt-1">Submitted {{ dateTime(attempt.submittedAt) }}<template v-if="attempt.cycle > 1"> · Round {{ attempt.cycle }}</template></div>
      </div>
      <div class="d-flex ga-5 text-body-2">
        <div><div class="text-muted">Multiple choice (auto)</div><div class="gnum">{{ mcqScore }} / {{ mcqMax }}</div></div>
        <div><div class="text-muted">Written</div><div class="gnum">{{ essayCount }} {{ essayCount === 1 ? 'answer' : 'answers' }}</div></div>
      </div>
    </div>

    <div v-if="readonly" class="callout">This attempt is already graded. Scores are shown read-only.</div>

    <div v-for="(q, i) in attempt.quiz.questions" :key="q.id" class="panel pa-6 d-flex flex-column ga-3">
      <div class="d-flex justify-space-between ga-3 text-caption">
        <span class="qlabel">Question {{ i + 1 }} · {{ q.type === 'MCQ' ? 'Multiple choice' : 'Written answer' }}</span>
        <span class="text-muted">Max {{ q.points }} {{ q.points === 1 ? 'point' : 'points' }}</span>
      </div>
      <div class="qtext">{{ q.text }}</div>
      <template v-if="q.type === 'MCQ'">
        <div class="answer">
          Answer: {{ q.options.find((o) => o.id === answerOf(q.id)?.optionId)?.text ?? '(no answer)' }}
          <strong :style="{ color: q.options.find((o) => o.id === answerOf(q.id)?.optionId)?.isCorrect ? 'var(--ot-success)' : 'var(--ot-danger)' }">
            · {{ q.options.find((o) => o.id === answerOf(q.id)?.optionId)?.isCorrect ? 'Correct' : 'Incorrect' }}
          </strong>
        </div>
      </template>
      <template v-else>
        <div class="answer" style="white-space: pre-line">{{ answerOf(q.id)?.essayText || '(no answer)' }}</div>
        <div v-if="grades[q.id]" class="d-flex flex-wrap ga-4">
          <div class="d-flex flex-column ga-1" style="flex: 0 1 160px">
            <label :for="`pts-${q.id}`" class="flabel">Points (0 to {{ q.points }})</label>
            <input :id="`pts-${q.id}`" v-model.number="grades[q.id]!.points" type="number" min="0" :max="q.points" class="ot-input" :readonly="readonly" :aria-invalid="!validPts(q.id, q.points)" />
            <span v-if="!validPts(q.id, q.points)" class="text-caption" style="color: var(--ot-danger)">0 to {{ q.points }}</span>
          </div>
          <div class="d-flex flex-column ga-1" style="flex: 1 1 280px">
            <label :for="`cmt-${q.id}`" class="flabel">Comment for the learner</label>
            <textarea :id="`cmt-${q.id}`" v-model="grades[q.id]!.comment" rows="3" class="ot-input ta" :readonly="readonly" maxlength="2000" />
          </div>
        </div>
      </template>
    </div>

    <div class="total" :class="passes ? 'pass' : 'fail'">
      <div class="d-flex flex-column ga-1">
        <span class="text-body-2 text-2">Total {{ readonly ? '' : 'after this grade' }}</span>
        <span class="tnum">{{ total }} / {{ max }} · {{ max ? Math.round((total / max) * 100) : 0 }}%</span>
        <span class="tres">Pass mark {{ attempt.quiz.passPercent }}% · Result: {{ passes ? 'Pass, certificate will be issued' : 'Not passed' }}</span>
      </div>
      <v-btn v-if="!readonly" color="primary" min-height="48" class="px-6" :loading="saving" :disabled="!allValid" @click="save">Save grade and notify</v-btn>
    </div>
  </section>
</template>

<style scoped>
.gform {
  flex: 999 1 460px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.gname {
  font-size: 17px;
  font-weight: 600;
}
.gnum {
  font-size: 18px;
  font-weight: 600;
  margin-top: 2px;
}
.qlabel {
  color: var(--ot-accent-strong);
  font-weight: 600;
}
.qtext {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.45;
}
.answer {
  padding: 14px 16px;
  border-radius: 4px;
  background: var(--ot-bg);
  border: 1px solid var(--ot-border);
  font-size: 14px;
  line-height: 1.7;
  color: var(--ot-text-2);
}
.flabel {
  font-size: 13px;
  font-weight: 500;
}
.ta {
  height: auto;
  padding: 12px 14px;
  line-height: 1.5;
  resize: vertical;
}
.total {
  border: 1px solid var(--ot-success-border);
  border-radius: var(--ot-radius-card);
  background: var(--ot-success-bg);
  padding: 20px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  --tone: var(--ot-success);
}
.total.fail {
  border-color: var(--ot-warning-border);
  background: var(--ot-warning-bg);
  --tone: var(--ot-warning);
}
.tnum {
  font-size: 20px;
  font-weight: 700;
}
.tres {
  font-size: 13px;
  font-weight: 600;
  color: var(--tone);
}
</style>
