<script setup lang="ts">
// Home hero (mockup Main): headline text on the left, the admin-uploaded banner images on the right.
// With several banners they slide on their own every 6 s, in order, and loop back to the first by sliding
// forward onto a copy of it (no rewind). The shown image zooms out slowly; the active dot fills up as a timer.
// Paused while the pointer or keyboard focus is on the hero and while the tab is hidden.
// Reduced motion: still rotates, but switches without sliding or zooming.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Landing } from '@/types';

const props = defineProps<{ banners: Landing['banners']; texts: Record<string, string> }>();

const INTERVAL_MS = 6000;
const pos = ref(0); // slide position on the track; pos === n is the copy of the first banner
const animate = ref(true);
const paused = ref(false);
const elapsed = ref(0);

const n = computed(() => props.banners.length);
const many = computed(() => n.value > 1);
const i = computed(() => (n.value ? pos.value % n.value : 0));
const slides = computed(() => (many.value ? [...props.banners, props.banners[0]] : props.banners));
const cur = computed(() => props.banners[i.value] ?? null);
const featured = computed(() => cur.value?.linkUrl ?? null);
const internal = computed(() => !!featured.value && featured.value.startsWith('/'));
const progress = computed(() => Math.min(1, elapsed.value / INTERVAL_MS));
const perks = [
  { icon: 'mdi-play-circle-outline', label: 'Video lessons' },
  { icon: 'mdi-clipboard-check-outline', label: 'Final test' },
  { icon: 'mdi-certificate-outline', label: 'Certificate' },
];

/** Jump without animation (used to swap the first-banner copy for the real one). */
async function jump(to: number) {
  animate.value = false;
  pos.value = to;
  await nextTick();
  void document.body.offsetHeight; // apply the jump before turning the transition back on
  animate.value = true;
}

async function go(d: 1 | -1) {
  if (!many.value) return;
  elapsed.value = 0;
  if (d === 1) {
    if (pos.value >= n.value) await jump(0);
    pos.value += 1;
  } else {
    if (pos.value <= 0) await jump(n.value);
    pos.value -= 1;
  }
}

function goTo(k: number) {
  elapsed.value = 0;
  pos.value = k;
}

/** After sliding onto the copy of the first banner, swap in the real first one. */
function onSlid(e: TransitionEvent) {
  if (e.target === e.currentTarget && e.propertyName === 'transform' && pos.value === n.value) void jump(0);
}

let timer: ReturnType<typeof setInterval> | undefined;
const TICK = 100;
onMounted(() => {
  timer = setInterval(() => {
    if (!many.value || paused.value || document.hidden) return;
    elapsed.value += TICK;
    if (elapsed.value >= INTERVAL_MS) void go(1);
  }, TICK);
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
      <div v-if="slides.length" class="track" :class="{ animate }" :style="{ transform: `translateX(${-pos * 100}%)` }" @transitionend="onSlid">
        <div
          v-for="(b, k) in slides"
          :key="`${b.id}-${k}`"
          class="slide"
          :class="{ active: k === pos }"
          :aria-hidden="k !== pos ? 'true' : undefined"
        >
          <img :src="b.imageUrl" :alt="k === pos ? b.altText ?? '' : ''" :loading="k === 0 ? 'eager' : 'lazy'" />
        </div>
      </div>
      <span v-else class="ph" aria-hidden="true" />
      <button v-if="many" type="button" class="nav prev" aria-label="Previous banner" @click="go(-1)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <button v-if="many" type="button" class="nav next" aria-label="Next banner" @click="go(1)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
      </button>
    </div>
    <template v-if="many">
      <div class="dots">
        <button v-for="(b, k) in banners" :key="b.id" type="button" :class="{ on: k === i }" :aria-label="`Show banner ${k + 1}`" :aria-current="k === i ? 'true' : undefined" @click="goTo(k)">
          <span v-if="k === i" class="fill" :style="{ transform: `scaleX(${progress})` }" />
        </button>
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
  padding: 56px 48px 64px;
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
.art {
  overflow: hidden;
}
.track {
  position: absolute;
  inset: 0;
  display: flex;
  will-change: transform;
}
/* Slow and smooth: eases in and out over 1.1 s. */
.track.animate {
  transition: transform 1.1s cubic-bezier(0.65, 0, 0.35, 1);
}
.slide {
  position: relative;
  flex: 0 0 100%;
  height: 100%;
  overflow: hidden;
}
.slide img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform: scale(1.08);
  transition: transform 7s cubic-bezier(0.22, 1, 0.36, 1);
}
/* The banner on show zooms out gently while it is visible. */
.slide.active img {
  transform: scale(1);
}
/* Previous / next: on the banner image, left and right edges, see-through until hovered. */
.nav {
  position: absolute;
  top: 50%;
  z-index: 1;
  width: 44px;
  height: 44px;
  margin-top: -22px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(6px);
  color: var(--ot-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 10px rgba(19, 36, 61, 0.15);
  transition: background var(--ot-transition), transform var(--ot-transition);
}
.nav:hover {
  background: rgba(255, 255, 255, 0.85);
  transform: scale(1.06);
}
.prev {
  left: 16px;
}
.next {
  right: 16px;
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
.dots button.on {
  width: 52px;
}
.dots button.on::before {
  width: 28px;
  background: color-mix(in srgb, var(--ot-accent) 28%, transparent);
}
/* Timer: the active dot fills from left to right until the next banner. */
.fill {
  position: absolute;
  top: 50%;
  left: 12px;
  width: 28px;
  height: 8px;
  margin-top: -4px;
  border-radius: var(--ot-radius-pill);
  background: var(--ot-accent);
  transform-origin: left center;
  transition: transform 0.1s linear;
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
  .track.animate,
  .slide img,
  .dots button::before {
    transition: none;
  }
  .slide img {
    transform: none;
  }
}
</style>
