<script setup lang="ts">
// Final test settings + questions. Used by admins (course editor) and assigned instructors (base '/instructor').
import { computed, ref, watch } from 'vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import QuestionEditor from './QuestionEditor.vue';
import { quizApi, type QuestionInput, type QuizBase, type QuizSettings, type QuizView } from '@/api/admin/quiz';
import type { AdminQuestion } from '@/api/admin/courses';
import { errorMessage } from '@/api/client';

const props = withDefaults(defineProps<{ course: { id: string; quiz: QuizView }; base?: QuizBase }>(), { base: '/admin' });
const api = quizApi(props.base);
const emit = defineEmits<{ changed: [] }>();
const s = ref<QuizSettings>({ passPercent: 70, timeLimitMin: null, maxAttempts: 3 });
const editing = ref<AdminQuestion | null>(null);
const editorOpen = ref(false);
const del = ref<AdminQuestion | null>(null);
const busy = ref(false);
const err = ref('');
const ok = ref(false);
const qs = computed(() => props.course.quiz?.questions ?? []);
const totalPts = computed(() => qs.value.reduce((a, q) => a + q.points, 0));
watch(
  () => props.course.quiz,
  (q) => {
    if (q) s.value = { passPercent: q.passPercent, timeLimitMin: q.timeLimitMin, maxAttempts: q.maxAttempts };
  },
  { immediate: true },
);
async function saveSettings() {
  busy.value = true;
  err.value = '';
  try {
    await api.saveSettings(props.course.id, { ...s.value, timeLimitMin: s.value.timeLimitMin || null });
    ok.value = true;
    emit('changed');
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function saveQuestion(q: QuestionInput) {
  busy.value = true;
  err.value = '';
  try {
    if (!props.course.quiz) await api.saveSettings(props.course.id, s.value);
    const quizId = props.course.quiz?.id ?? (await api.getQuiz(props.course.id))!.id;
    if (editing.value) await api.updateQuestion(editing.value.id, q);
    else await api.addQuestion(quizId, q);
    editorOpen.value = false;
    emit('changed');
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (!del.value) return;
  await api.removeQuestion(del.value.id);
  del.value = null;
  emit('changed');
}
async function move(i: number, dir: -1 | 1) {
  const qs = props.course.quiz!.questions.map((q) => q.id);
  const j = i + dir;
  if (j < 0 || j >= qs.length) return;
  [qs[i], qs[j]] = [qs[j]!, qs[i]!];
  await api.reorderQuestions(props.course.quiz!.id, qs);
  emit('changed');
}
function openEditor(q: AdminQuestion | null) {
  editing.value = q;
  editorOpen.value = true;
}
</script>

<template>
  <div class="d-flex flex-column ga-4">
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <div class="q-split">
      <section class="panel pa-5 d-flex flex-column ga-1 q-settings" aria-labelledby="qs-h">
        <h2 id="qs-h" class="h3 mb-3">Test settings</h2>
        <v-text-field v-model.number="s.passPercent" type="number" min="1" max="100" label="Pass mark (%)" />
        <v-text-field v-model.number="s.timeLimitMin" type="number" min="0" label="Time limit (minutes, empty = none)" />
        <v-text-field v-model.number="s.maxAttempts" type="number" min="1" max="10" label="Attempts allowed" />
        <span class="text-caption text-muted mb-3">If a learner uses every attempt without passing, their lessons reset and they start the course again.</span>
        <v-btn color="primary" :loading="busy" @click="saveSettings">Save settings</v-btn>
      </section>

      <section class="d-flex flex-column ga-3 q-list" aria-labelledby="ql-h">
        <div class="d-flex flex-wrap align-center justify-space-between ga-3">
          <h2 id="ql-h" class="h3">Questions ({{ qs.length }} · {{ totalPts }} points)</h2>
          <v-btn color="primary" @click="openEditor(null)">+ Add question</v-btn>
        </div>
        <div v-if="!qs.length" class="panel pa-10 text-center text-body-2 text-muted">No questions. Without questions the course has no final test.</div>
        <article v-for="(q, i) in qs" :key="q.id" class="panel pa-5 d-flex flex-column ga-3">
          <div class="d-flex flex-wrap align-center justify-space-between ga-2">
            <span class="text-caption font-weight-bold text-muted">Question {{ i + 1 }} · {{ q.type === 'MCQ' ? 'Multiple choice' : 'Written answer' }} · {{ q.points }} {{ q.points === 1 ? 'point' : 'points' }}</span>
            <span class="d-flex align-center ga-1">
              <button type="button" class="row-link" :disabled="i === 0" :aria-label="`Move question ${i + 1} up`" @click="move(i, -1)">↑</button>
              <button type="button" class="row-link" :disabled="i === qs.length - 1" :aria-label="`Move question ${i + 1} down`" @click="move(i, 1)">↓</button>
              <button type="button" class="row-link" @click="openEditor(q)">Edit</button>
              <button type="button" class="row-link danger" @click="del = q">Remove</button>
            </span>
          </div>
          <div class="text-body-1">{{ q.text }}</div>
          <div v-if="q.type === 'MCQ'" class="d-flex flex-column ga-2">
            <div v-for="o in q.options" :key="o.id" class="opt" :class="{ right: o.isCorrect }">
              <span>{{ o.text }}</span>
              <span v-if="o.isCorrect" class="text-caption font-weight-bold">Correct</span>
            </div>
          </div>
          <div v-else class="callout">Needs manual grading by an instructor.</div>
        </article>
      </section>
    </div>
    <QuestionEditor v-model="editorOpen" :question="editing" :loading="busy" @save="saveQuestion" />
    <ConfirmDialog :model-value="!!del" title="Delete this question?" danger confirm-label="Delete" @update:model-value="del = null" @confirm="remove" />
    <v-snackbar v-model="ok" :timeout="2500">Saved</v-snackbar>
  </div>
</template>

<style scoped>
.q-split {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;
}
.q-settings {
  flex: 1 1 280px;
  max-width: 340px;
}
.q-list {
  flex: 999 1 460px;
  min-width: 0;
}
@media (max-width: 860px) {
  .q-settings {
    max-width: none;
  }
}
.h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--ot-border);
  border-radius: 4px;
  font-size: 14px;
}
.opt.right {
  border-color: var(--ot-success-border);
  background: var(--ot-success-bg);
  color: var(--ot-success);
}
.row-link:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
