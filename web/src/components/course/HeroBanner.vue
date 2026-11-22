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
      <span class="kicker">{{ texts.kicker || 'New course' }}</span>
      <h1>{{ texts.title || 'Learn practical skills, step by step' }}</h1>
      <p>{{ texts.subtitle || 'Video lessons, a final test and a certificate.' }}</p>
      <div class="d-flex flex-wrap ga-3 mt-1">
        <a href="#catalog" class="btn primary">Browse courses</a>
        <router-link v-if="internal" :to="featured!" class="btn">View featured course</router-link>
        <a v-else-if="featured" :href="featured" class="btn">View featured course</a>
      </div>
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
  min-height: 340px;
  border: 1px solid var(--ot-border);
  border-radius: 6px;
  overflow: hidden;
  background: #eaf2fb;
  box-shadow: var(--ot-shadow-card);
}
.text {
  flex: 1 1 420px;
  padding: 48px 48px 80px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
}
.kicker {
  align-self: flex-start;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ot-accent);
  border: 1px solid var(--ot-info-border);
  border-radius: 3px;
  padding: 4px 10px;
}
h1 {
  margin: 0;
  font-size: 40px;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ot-text);
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
  padding: 13px 22px;
  border-radius: 4px;
  border: 1px solid var(--ot-input-border);
  background: var(--ot-surface);
  color: var(--ot-text);
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  box-shadow: var(--ot-shadow-btn);
}
.btn.primary {
  border-color: var(--ot-accent);
  background: var(--ot-accent);
  color: #fff;
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
  background: repeating-linear-gradient(135deg, #e8eff7 0, #e8eff7 14px, #dfe8f2 14px, #dfe8f2 28px);
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
  right: 24px;
  bottom: 28px;
  display: flex;
  gap: 8px;
}
.dots button {
  width: 6px;
  height: 6px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: #b5c2d1;
  cursor: pointer;
  transition: width 0.2s;
}
.dots button.on {
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
    font-size: 30px;
  }
  .art {
    min-height: 180px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active,
  .dots button {
    transition: none;
  }
}
</style>
