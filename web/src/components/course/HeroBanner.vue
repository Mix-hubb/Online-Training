<script setup lang="ts">
// Home hero (mockup Main): headline text on the left, the admin-uploaded banner image on the right.
// With several banners it rotates every 7 s (paused on hover/focus and for reduced motion), with
// round previous/next buttons bottom-left and dots bottom-right.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Landing } from '@/types';

const props = defineProps<{ banners: Landing['banners']; texts: Record<string, string> }>();
const i = ref(0);
const paused = ref(false);
const cur = computed(() => props.banners[i.value] ?? null);
const many = computed(() => props.banners.length > 1);
const featured = computed(() => cur.value?.linkUrl ?? null);
const internal = computed(() => !!featured.value && featured.value.startsWith('/'));
const perks = [
  { icon: 'mdi-play-circle-outline', label: 'Video lessons' },
  { icon: 'mdi-clipboard-check-outline', label: 'Final test' },
  { icon: 'mdi-certificate-outline', label: 'Certificate' },
];

function go(d: number) {
  const n = props.banners.length;
  if (n) i.value = (i.value + d + n) % n;
}
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  timer = setInterval(() => {
    if (many.value && !paused.value) go(1);
  }, 7000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <section aria-label="Featured banners" class="hero" @mouseenter="paused = true" @mouseleave="paused = false" @focusin="paused = true" @focusout="paused = false">
    <div class="text">
      <h1>{{ texts.title || 'Learn practical skills, step by step' }}</h1>
      <p>{{ texts.subtitle || 'Video lessons, a final test and a certificate.' }}</p>
      <div class="d-flex flex-wrap ga-3 mt-1">
        <a href="#catalog" class="btn primary">Browse courses</a>
        <router-link v-if="internal" :to="featured!" class="btn">View featured course</router-link>
        <a v-else-if="featured" :href="featured" class="btn">View featured course</a>
      </div>
      <ul class="perks" aria-label="Every course includes">
        <li v-for="p in perks" :key="p.label"><v-icon :icon="p.icon" size="18" />{{ p.label }}</li>
      </ul>
    </div>
    <div class="art">
      <Transition name="fade" mode="out-in">
        <img v-if="cur" :key="cur.id" :src="cur.imageUrl" :alt="cur.altText ?? ''" />
        <span v-else class="ph" aria-hidden="true" />
      </Transition>
    </div>
    <template v-if="many">
      <button type="button" class="nav prev" aria-label="Previous banner" @click="go(-1)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <button type="button" class="nav next" aria-label="Next banner" @click="go(1)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
      </button>
      <div class="dots">
        <button v-for="(b, k) in banners" :key="b.id" type="button" :class="{ on: k === i }" :aria-label="`Show banner ${k + 1}`" :aria-current="k === i ? 'true' : undefined" @click="i = k" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  min-height: 380px;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-card);
  overflow: hidden;
  background: var(--ot-wash-hero);
  box-shadow: var(--ot-shadow-card);
}
/* Dot grid behind the text, fading to the right */
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(color-mix(in srgb, var(--ot-accent) 22%, transparent) 1px, transparent 1.4px);
  background-size: 18px 18px;
  mask-image: linear-gradient(100deg, #000 0%, transparent 55%);
  pointer-events: none;
}
.text {
  position: relative;
  flex: 1 1 420px;
  padding: 56px 48px 88px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
}
h1 {
  margin: 0;
  font-size: 48px;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--ot-text);
  max-width: 620px;
}
.perks {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  font-size: var(--ot-fs-sm);
  font-weight: 500;
  color: var(--ot-text-2);
}
.perks li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.perks :deep(.v-icon) {
  color: var(--ot-accent);
}
p {
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
  color: var(--ot-muted);
  max-width: 480px;
}
.btn {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding: 0 22px;
  transition: background var(--ot-transition), box-shadow var(--ot-transition), transform var(--ot-transition);
  border-radius: var(--ot-radius-control);
  border: 1px solid var(--ot-input-border);
  background: var(--ot-surface);
  color: var(--ot-text);
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  box-shadow: var(--ot-shadow-btn);
}
.btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--ot-shadow-hover);
}
.btn.primary {
  border-color: var(--ot-accent-strong);
  background: var(--ot-accent-grad);
  color: var(--ot-surface);
  font-weight: 600;
  box-shadow: var(--ot-shadow-btn-primary);
}
.btn.primary:hover {
  background: var(--ot-accent-strong);
}
.btn:focus-visible,
.nav:focus-visible,
.dots button:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: 2px;
}
.art {
  flex: 1 1 380px;
  min-height: 260px;
  position: relative;
  background: var(--ot-thumb);
}
.art img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.nav {
  position: absolute;
  bottom: 16px;
  width: 44px;
  height: 44px;
  border-radius: 22px;
  border: 1px solid var(--ot-input-border);
  background: var(--ot-bg);
  color: var(--ot-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--ot-shadow-btn);
}
.prev {
  left: 16px;
}
.next {
  left: 68px;
}
.dots {
  position: absolute;
  right: 12px;
  bottom: 8px;
  display: flex;
}
/* The button is a 44px target; the visible dot is drawn by ::before. */
.dots button {
  position: relative;
  width: var(--ot-control-h);
  height: var(--ot-control-h);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.dots button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  transform: translate(-50%, -50%);
  border-radius: var(--ot-radius-pill);
  background: var(--ot-input-border);
  transition: width 0.2s, background 0.2s;
}
.dots button:hover::before {
  background: var(--ot-muted);
}
.dots button.on::before {
  width: 24px;
  background: var(--ot-accent);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@media (max-width: 600px) {
  .text {
    padding: 28px 20px 24px;
  }
  h1 {
    font-size: 32px;
  }
  .art {
    min-height: 180px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active,
  .dots button::before {
    transition: none;
  }
}
</style>
