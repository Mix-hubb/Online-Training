<script setup lang="ts">
// Lesson list in the player (mockup): status icon, title, "Completed / Now playing / Locked · time",
// current lesson marked with a blue left edge. Locked lessons cannot be opened (spec 4: sequential unlock).
import type { LearnData } from '@/types';
import { duration } from '@/utils/format';

defineProps<{ data: LearnData; currentId: string | null; slug: string }>();
defineEmits<{ select: [string] }>();
</script>

<template>
  <ol class="lessons">
    <li v-for="(l, i) in data.lessons" :key="l.id">
      <button
        type="button"
        class="row"
        :class="{ cur: l.id === currentId, locked: !l.unlocked }"
        :disabled="!l.unlocked"
        :aria-current="l.id === currentId ? 'true' : undefined"
        @click="$emit('select', l.id)"
      >
        <span class="ico" :class="{ ok: l.completed, cur: l.id === currentId && !l.completed }">
          <v-icon :icon="l.completed ? 'mdi-check' : l.unlocked ? 'mdi-play' : 'mdi-lock-outline'" size="14" />
        </span>
        <span class="flex-grow-1" style="min-width: 0">
          <span class="d-block t">{{ i + 1 }}. {{ l.title }}</span>
          <span class="d-block text-caption text-muted mt-1">
            {{ l.completed ? 'Completed' : l.id === currentId ? 'Now playing' : l.unlocked ? 'Open' : 'Locked' }} · {{ duration(l.durationSec) }}
          </span>
        </span>
      </button>
    </li>
    <li v-if="data.quiz">
      <router-link v-if="data.quiz.unlocked" :to="`/learn/${slug}/quiz`" class="row test">
        <span class="ico cur"><v-icon icon="mdi-checkbox-marked-outline" size="14" /></span>
        <span class="flex-grow-1">
          <span class="d-block t font-weight-bold">Final test</span>
          <span class="d-block text-caption text-muted mt-1">{{ data.quiz.questionCount }} questions · {{ data.quiz.maxAttempts - data.quiz.attemptsUsed }} attempts left</span>
        </span>
      </router-link>
      <div v-else class="row test locked">
        <span class="ico"><v-icon icon="mdi-lock-outline" size="14" /></span>
        <span class="flex-grow-1">
          <span class="d-block t font-weight-bold">Final test</span>
          <span class="d-block text-caption text-muted mt-1">Locked · finish all {{ data.lessons.length }} lessons first</span>
        </span>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.lessons {
  list-style: none;
  margin: 0;
  padding: 0;
}
.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px 14px 17px;
  border: 0;
  border-left: 3px solid transparent;
  border-bottom: 1px solid var(--ot-border);
  background: transparent;
  text-align: left;
  color: var(--ot-text);
  text-decoration: none;
  cursor: pointer;
  font: inherit;
}
.row:hover:not(:disabled):not(.locked) {
  background: var(--ot-raised);
}
.row.cur {
  background: var(--ot-info-bg);
  border-left-color: var(--ot-accent);
}
.row.cur .t {
  font-weight: 600;
}
.row.locked {
  cursor: default;
}
.row.locked .t {
  color: var(--ot-muted);
}
.row.test {
  background: var(--ot-deep);
  border-bottom: 0;
}
.t {
  font-size: 14px;
}
.ico {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ot-deep);
  color: var(--ot-muted);
}
.ico.ok {
  background: var(--ot-success-bg);
  color: var(--ot-success);
}
.ico.cur {
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
}
</style>
