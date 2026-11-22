<script setup lang="ts">
// Course card (mockup): image with category tag, title, level + lessons tags, price and "View course".
import type { CourseCard } from '@/types';
import { levelLabel, priceLabel } from '@/utils/format';

defineProps<{ course: CourseCard; cta?: string }>();
</script>

<template>
  <div class="card-wrap h-100">
    <router-link :to="`/courses/${course.slug}`" class="course-card panel">
      <div class="thumb">
        <img v-if="course.thumbnailUrl" :src="course.thumbnailUrl" alt="" loading="lazy" />
        <span v-if="course.category" class="cat">{{ course.category.name }}</span>
      </div>
      <div class="body">
        <div class="title">{{ course.title }}</div>
        <div class="d-flex flex-wrap ga-2">
          <span class="tag">{{ levelLabel[course.level] }}</span>
          <span class="tag">{{ course.lessonCount }} {{ course.lessonCount === 1 ? 'lesson' : 'lessons' }}</span>
        </div>
        <div class="foot">
          <span class="price" :class="{ free: course.isFree }">{{ priceLabel(course) }}</span>
          <span class="cta">{{ cta ?? 'View course' }}</span>
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
  transition: border-color 0.15s;
}
.course-card:hover {
  border-color: var(--ot-info-border);
}
.thumb {
  position: relative;
  height: 160px;
  background: var(--ot-thumb);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cat {
  position: absolute;
  left: 14px;
  bottom: 14px;
  font-size: 12px;
  color: var(--ot-muted);
  background: rgba(255, 255, 255, 0.92);
  padding: 4px 10px;
  border-radius: 3px;
}
.body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}
.title {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.35;
}
.foot {
  margin-top: auto;
  padding-top: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.price {
  font-size: 16px;
  font-weight: 600;
}
.price.free {
  color: var(--ot-success);
}
.cta {
  font-size: 13px;
  color: var(--ot-accent-strong);
}
</style>
