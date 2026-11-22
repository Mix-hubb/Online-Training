<script setup lang="ts">
// Course card: cover (image or drawn from the topic), topic chip in the topic color, title, summary,
// level / lessons / length, and the price with USD and THB labelled on separate lines.
import { computed } from 'vue';
import CourseCover from './CourseCover.vue';
import type { CourseCard } from '@/types';
import { duration, levelLabel, money } from '@/utils/format';
import { topicTone } from '@/utils/topic';

const props = defineProps<{ course: CourseCard; cta?: string }>();
const tone = computed(() => topicTone(props.course.category?.name || props.course.title));
const enrolled = computed(() => props.cta === 'Enrolled');
</script>

<template>
  <div class="card-wrap h-100">
    <router-link :to="`/courses/${course.slug}`" class="course-card panel">
      <div class="thumb">
        <CourseCover :image-url="course.thumbnailUrl" :topic="course.category?.name" :title="course.title" />
        <span v-if="course.isFree" class="ribbon">Free course</span>
      </div>
      <div class="body">
        <span v-if="course.category" class="topic" :style="{ background: `var(--ot-topic-${tone}-bg)`, color: `var(--ot-topic-${tone}-fg)` }">{{ course.category.name }}</span>
        <div class="title">{{ course.title }}</div>
        <p v-if="course.summary" class="summary clamp-2">{{ course.summary }}</p>
        <div class="meta">
          <span><v-icon icon="mdi-signal-cellular-2" size="16" />{{ levelLabel[course.level] }}</span>
          <span><v-icon icon="mdi-play-circle-outline" size="16" />{{ course.lessonCount }} {{ course.lessonCount === 1 ? 'lesson' : 'lessons' }}</span>
          <span v-if="course.durationSec"><v-icon icon="mdi-clock-outline" size="16" />{{ duration(course.durationSec) }}</span>
        </div>
        <div class="foot">
          <span v-if="course.isFree" class="price free">Free</span>
          <span v-else class="price">
            <span v-if="course.priceMinor > 0" class="usd">{{ money(course.priceMinor, 'usd') }}<small>USD</small></span>
            <span v-if="course.priceThbMinor" class="thb">{{ money(course.priceThbMinor, 'thb') }}</span>
          </span>
          <span class="cta" :class="{ enrolled }">
            <v-icon v-if="enrolled" icon="mdi-check-circle" size="16" />{{ cta ?? 'View course' }}
            <v-icon v-if="!enrolled" icon="mdi-arrow-right" size="16" class="arrow" />
          </span>
        </div>
      </div>
    </router-link>
  </div>
</template>

<style scoped>
.card-wrap {
  position: relative;
  display: flex;
}
.course-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  text-decoration: none;
  color: var(--ot-text);
  transition: border-color var(--ot-transition), box-shadow 0.25s var(--ot-ease-out), transform 0.25s var(--ot-ease-out);
}
.course-card:hover {
  transform: translateY(-3px);
}
.course-card:hover :deep(img) {
  transform: scale(1.04);
}
.thumb {
  position: relative;
  height: 168px;
  border-bottom: 1px solid var(--ot-border);
}
.ribbon {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 3px 10px;
  border-radius: var(--ot-radius-pill);
  background: var(--ot-hl);
  color: var(--ot-navy);
  font-size: var(--ot-fs-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.body {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}
.topic {
  align-self: flex-start;
  font-size: var(--ot-fs-xs);
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--ot-radius-pill);
}
.title {
  font-family: var(--ot-font-display);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
}
.summary {
  margin: 0;
  font-size: var(--ot-fs-sm);
  line-height: 1.55;
  color: var(--ot-muted);
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: var(--ot-fs-sm);
  color: var(--ot-text-2);
}
.meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.meta :deep(.v-icon) {
  color: var(--ot-faint);
}
.foot {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px dashed var(--ot-border);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.price {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.usd {
  font-family: var(--ot-font-display);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.usd small {
  margin-left: 4px;
  font-family: var(--ot-font);
  font-size: var(--ot-fs-xs);
  font-weight: 600;
  color: var(--ot-muted);
}
.thb {
  font-size: var(--ot-fs-sm);
  color: var(--ot-muted);
}
.price.free {
  font-family: var(--ot-font-display);
  font-size: 22px;
  font-weight: 800;
  color: var(--ot-success);
}
.cta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--ot-fs-sm);
  font-weight: 600;
  color: var(--ot-accent-strong);
}
.cta.enrolled {
  color: var(--ot-success);
}
.arrow {
  transition: transform var(--ot-transition);
}
.course-card:hover .arrow {
  transform: translateX(3px);
}
@media (prefers-reduced-motion: reduce) {
  .course-card,
  .course-card:hover,
  .course-card:hover :deep(img) {
    transition: none;
    transform: none;
  }
}
</style>
