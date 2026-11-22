<script setup lang="ts">
// Course cover. Shows the uploaded image when there is one; otherwise draws a cover from the course topic:
// the topic's color pair (same topic = same color everywhere), a topic icon and a light grid pattern.
import { computed } from 'vue';
import { topicIcon, topicTone } from '@/utils/topic';

const props = withDefaults(
  defineProps<{ imageUrl?: string | null; topic?: string | null; title: string; size?: 'sm' | 'md' | 'lg'; label?: boolean }>(),
  { imageUrl: null, topic: null, size: 'md', label: false },
);
const key = computed(() => props.topic || props.title);
const tone = computed(() => topicTone(key.value));
const icon = computed(() => topicIcon(`${props.topic ?? ''} ${props.title}`));
</script>

<template>
  <div class="cover" :class="[`size-${size}`, { drawn: !imageUrl }]" :style="{ '--c-bg': `var(--ot-topic-${tone}-bg)`, '--c-fg': `var(--ot-topic-${tone}-fg)` }">
    <img v-if="imageUrl" :src="imageUrl" alt="" loading="lazy" />
    <template v-else>
      <span class="grid-bg" aria-hidden="true" />
      <span class="ghost" aria-hidden="true"><v-icon :icon="icon" /></span>
      <span class="mark" aria-hidden="true"><v-icon :icon="icon" /></span>
      <span v-if="label && topic" class="topic">{{ topic }}</span>
    </template>
  </div>
</template>

<style scoped>
.cover {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--c-bg) 35%, color-mix(in srgb, var(--c-bg) 72%, var(--c-fg) 28%) 100%);
  color: var(--c-fg);
}
.cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s var(--ot-ease-out);
}
.grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--c-fg) 14%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--c-fg) 14%, transparent) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: linear-gradient(110deg, transparent 20%, #000 90%);
}
.ghost {
  position: absolute;
  right: -6%;
  bottom: -22%;
  color: color-mix(in srgb, var(--c-fg) 16%, transparent);
  transform: rotate(-12deg);
  transition: transform 0.5s var(--ot-ease-out);
}
.ghost :deep(.v-icon) {
  font-size: 180px;
}
.size-sm .ghost {
  display: none;
}
.size-lg .ghost :deep(.v-icon) {
  font-size: 360px;
}
.mark {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 14px;
  background: var(--ot-surface);
  color: var(--c-fg);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--c-fg) 22%, transparent);
  transition: transform 0.4s var(--ot-ease-out);
}
.mark :deep(.v-icon) {
  font-size: 34px;
}
.size-sm .mark {
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  border-radius: 10px;
}
.size-sm .mark :deep(.v-icon) {
  font-size: 22px;
}
.size-sm .grid-bg {
  background-size: 14px 14px;
}
.size-lg .mark {
  left: 48px;
  width: 112px;
  height: 112px;
  border-radius: 24px;
}
.size-lg .mark :deep(.v-icon) {
  font-size: 60px;
}
.size-lg .grid-bg {
  background-size: 36px 36px;
}
.topic {
  position: absolute;
  right: 20px;
  bottom: 16px;
  font-family: var(--ot-font-display);
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: color-mix(in srgb, var(--c-fg) 55%, transparent);
}
.size-lg .topic {
  font-size: 32px;
  right: 40px;
  bottom: 28px;
}
</style>
