<script setup lang="ts">
// Edit one question: MCQ (2–6 options, exactly one correct) or essay.
import { ref, watch } from 'vue';
import type { QuestionInput } from '@/api/admin/quiz';
import type { AdminQuestion } from '@/api/admin/courses';

const open = defineModel<boolean>({ default: false });
const props = defineProps<{ question: AdminQuestion | null; loading?: boolean }>();
const emit = defineEmits<{ save: [QuestionInput] }>();
const f = ref<QuestionInput>({ type: 'MCQ', text: '', points: 1, options: [] });
const correct = ref(0);
const err = ref('');
watch(open, (o) => {
  if (!o) return;
  err.value = '';
  const q = props.question;
  f.value = q
    ? { type: q.type, text: q.text, points: q.points, options: q.options.map((x) => ({ text: x.text, isCorrect: x.isCorrect })) }
    : { type: 'MCQ', text: '', points: 1, options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] };
  correct.value = Math.max(0, f.value.options.findIndex((x) => x.isCorrect));
});
function save() {
  err.value = '';
  if (!f.value.text.trim()) return void (err.value = 'Write the question.');
  if (f.value.type === 'MCQ') {
    const opts = f.value.options.map((o, i) => ({ text: o.text.trim(), isCorrect: i === correct.value }));
    if (opts.length < 2 || opts.some((o) => !o.text)) return void (err.value = 'Fill in at least 2 options.');
    emit('save', { ...f.value, text: f.value.text.trim(), options: opts });
  } else emit('save', { ...f.value, text: f.value.text.trim(), options: [] });
}
</script>

<template>
  <v-dialog v-model="open" max-width="640">
    <v-card color="surface" class="pa-2">
      <v-card-title>{{ question ? 'Edit question' : 'New question' }}</v-card-title>
      <v-card-text>
        <v-alert v-if="err" type="error" variant="tonal" density="compact" class="mb-3">{{ err }}</v-alert>
        <div class="d-flex ga-3 mb-2">
          <v-select v-model="f.type" label="Type" variant="outlined" :items="[{ title: 'Multiple choice', value: 'MCQ' }, { title: 'Written (graded by instructor)', value: 'ESSAY' }]" />
          <v-text-field v-model.number="f.points" type="number" min="1" max="100" label="Points" style="max-width: 120px" />
        </div>
        <v-textarea v-model="f.text" label="Question" rows="2" auto-grow variant="outlined" class="mb-2" />
        <template v-if="f.type === 'MCQ'">
          <div class="text-body-2 mb-2">Options (select the correct one)</div>
          <v-radio-group v-model="correct" hide-details>
            <div v-for="(o, i) in f.options" :key="i" class="d-flex align-center ga-2 mb-2">
              <v-radio :value="i" class="flex-grow-0" :aria-label="`Option ${i + 1} is correct`" />
              <v-text-field v-model="o.text" :label="`Option ${i + 1}`" density="compact" hide-details />
              <v-btn icon="mdi-close" size="small" variant="text" :disabled="f.options.length <= 2" aria-label="Remove option" @click="f.options.splice(i, 1), correct >= f.options.length && (correct = 0)" />
            </div>
          </v-radio-group>
          <v-btn size="small" variant="text" prepend-icon="mdi-plus" :disabled="f.options.length >= 6" @click="f.options.push({ text: '', isCorrect: false })">Add option</v-btn>
        </template>
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn variant="text" @click="open = false">Cancel</v-btn><v-btn color="primary" variant="flat" :loading="loading" @click="save">Save</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
</template>
