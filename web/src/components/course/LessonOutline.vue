<script setup lang="ts">
// Lesson list on the course page (mockup): numbered rows with durations, then a "Final test" row.
// 2026-11-27: lessons the instructor marked as free preview get a "Watch free" link for people who do not own the course.
import type { CourseDetail } from '@/types';
import { duration } from '@/utils/format';
defineProps<{ lessons: CourseDetail['lessons']; enrolled: boolean; hasTest?: boolean; slug?: string; noLinks?: boolean }>();
</script>

<template>
  <ol class="outline panel">
    <li v-for="(l, i) in lessons" :key="l.id" class="row">
      <span class="num">{{ i + 1 }}</span>
      <span class="flex-grow-1" style="min-width: 0">
        <span class="d-block t">{{ l.title }}</span>
        <span v-if="l.description" class="d-block text-body-2 text-muted mt-1">{{ l.description }}</span>
      </span>
      <span class="text-body-2 text-muted text-no-wrap">{{ duration(l.durationSec) }}</span>
      <template v-if="!enrolled">
        <router-link v-if="l.isFreePreview && slug && !noLinks" :to="{ path: `/learn/${slug}`, query: { lesson: l.id } }" class="free">Watch free</router-link>
        <span v-else-if="l.isFreePreview" class="free">Free preview</span>
        <v-icon v-else icon="mdi-lock-outline" size="16" class="text-muted" aria-label="Locked" />
      </template>
    </li>
    <li v-if="hasTest" class="row test">
      <span class="num accent"><v-icon icon="mdi-checkbox-marked-outline" size="16" /></span>
      <span class="flex-grow-1 t font-weight-bold">Final test</span>
      <span class="text-body-2 text-muted">Unlocks after all lessons</span>
    </li>
  </ol>
</template>

<style scoped>
.free {
  flex: none;
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 10px;
  border-radius: var(--ot-radius-pill);
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
a.free:hover {
  text-decoration: underline;
}
.outline {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
.row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--ot-border);
}
.row:last-child {
  border-bottom: 0;
}
.row.test {
  background: var(--ot-raised);
}
.t {
  font-size: 15px;
}
.num {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: var(--ot-radius-card);
  background: var(--ot-deep);
  color: var(--ot-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}
.num.accent {
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
}
</style>
