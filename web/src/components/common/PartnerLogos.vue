<script setup lang="ts">
// Partner logo strip (mockup): a white panel with logos scrolling slowly; pauses on hover,
// stops when the user prefers reduced motion. Only partners with showLogo, ordered by logoOrder (API).
import { computed } from 'vue';

const props = defineProps<{ partners: { id: string; name: string; logoUrl: string | null; websiteUrl: string | null }[] }>();
// Always scroll (mockup); repeat the list so the strip is full and loops without a gap.
const moving = computed(() => props.partners.length > 0);
const loop = computed(() => {
  if (!moving.value) return props.partners;
  const times = Math.max(1, Math.ceil(12 / props.partners.length));
  return Array.from({ length: times * 2 }, () => props.partners).flat();
});
</script>

<template>
  <section class="marq panel" aria-label="Our partners">
    <div class="track" :class="{ moving }">
      <component
        :is="p.websiteUrl ? 'a' : 'span'"
        v-for="(p, i) in loop"
        :key="`${p.id}-${i}`"
        :href="p.websiteUrl ?? undefined"
        target="_blank"
        rel="noopener"
        class="logo"
        :title="p.name"
        :aria-hidden="i >= partners.length ? 'true' : undefined"
        :tabindex="i >= partners.length ? -1 : undefined"
      >
        <img v-if="p.logoUrl" :src="p.logoUrl" :alt="p.name" />
        <span v-else>{{ p.name }}</span>
      </component>
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
  gap: 16px;
  padding-left: 16px;
  width: max-content;
}
.track.moving {
  animation: marquee 40s linear infinite;
}
.marq:hover .track {
  animation-play-state: paused;
}
@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .track {
    animation: none;
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
