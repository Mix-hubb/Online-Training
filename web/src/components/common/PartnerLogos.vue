<script setup lang="ts">
// Partner logo strip (mockup): a white panel of partner logos. Only partners with showLogo, ordered by logoOrder (API).
// Scrolls slowly and without stopping, but only when the logos do not fit in the panel; if they fit, it stays still.
// Speed is fixed in px per second, so it looks the same with few or many partners.
// Client asked that it never stops: no pause on hover, and it keeps moving even with "reduce motion" on (slow speed).
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{ partners: { id: string; name: string; logoUrl: string | null; websiteUrl: string | null }[] }>();

const SPEED_PX_PER_SEC = 30;
const box = ref<HTMLElement | null>(null);
const group = ref<HTMLElement | null>(null);
const moving = ref(false);
const duration = ref('40s');

function measure() {
  if (!box.value || !group.value) return;
  const w = group.value.scrollWidth; // one copy of the list, including its spacing
  moving.value = props.partners.length > 0 && w > box.value.clientWidth;
  duration.value = `${Math.max(10, w / SPEED_PX_PER_SEC)}s`;
}

let ro: ResizeObserver | null = null;
onMounted(() => {
  ro = new ResizeObserver(measure);
  if (box.value) ro.observe(box.value);
  measure();
});
onBeforeUnmount(() => ro?.disconnect());
watch(
  () => props.partners,
  () => nextTick(measure),
  { deep: true },
);
</script>

<template>
  <section ref="box" class="marq panel" aria-label="Our partners">
    <div class="track" :class="{ moving }" :style="{ animationDuration: duration }">
      <!-- Two identical copies when moving: sliding by one copy (-50%) loops without a jump. -->
      <div v-for="copy in moving ? 2 : 1" :key="copy" :ref="copy === 1 ? (el) => (group = el as HTMLElement) : undefined" class="group" :aria-hidden="copy > 1 ? 'true' : undefined">
        <component
          :is="p.websiteUrl ? 'a' : 'span'"
          v-for="p in partners"
          :key="`${p.id}-${copy}`"
          :href="p.websiteUrl ?? undefined"
          target="_blank"
          rel="noopener"
          class="logo"
          :title="p.name"
          :tabindex="copy > 1 ? -1 : undefined"
        >
          <img v-if="p.logoUrl" :src="p.logoUrl" :alt="copy > 1 ? '' : p.name" />
          <span v-else>{{ p.name }}</span>
        </component>
      </div>
    </div>
  </section>
</template>

<style scoped>
.marq {
  position: relative;
  overflow: hidden;
  height: 60px;
  display: flex;
  align-items: center;
}
.track {
  display: flex;
  width: max-content;
}
.track.moving {
  animation-name: marquee;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
.group {
  display: flex;
  gap: 16px;
  padding-left: 16px;
}
@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
.logo {
  flex: none;
  width: 140px;
  height: 36px;
  border-radius: 4px;
  border: 1px solid var(--ot-border);
  background: var(--ot-raised);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--ot-faint);
  text-decoration: none;
  overflow: hidden;
}
.logo img {
  max-width: 120px;
  max-height: 28px;
  object-fit: contain;
}
</style>
