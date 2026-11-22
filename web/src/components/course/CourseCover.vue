<script setup lang="ts">
// Course cover. Shows the uploaded image when there is one; otherwise a plain cover in the topic's color
// (same topic = same color everywhere) with a light grid pattern. No icons.
import { computed } from 'vue';
import { topicTone } from '@/utils/topic';

const props = withDefaults(
  defineProps<{ imageUrl?: string | null; topic?: string | null; title: string; size?: 'sm' | 'md' | 'lg'; label?: boolean }>(),
  { imageUrl: null, topic: null, size: 'md', label: false },
);
const tone = computed(() => topicTone(props.topic || props.title));
</script>

<template>
  <div class="cover" :class="`size-${size}`" :style="{ '--c-bg': `var(--ot-topic-${tone}-bg)`, '--c-fg': `var(--ot-topic-${tone}-fg)` }">
    <img v-if="imageUrl" :src="imageUrl" alt="" loading="lazy" />
    <template v-else>
      <span class="grid-bg" aria-hidden="true" />
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
.size-sm .grid-bg {
  background-size: 14px 14px;
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
