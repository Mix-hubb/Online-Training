// v-reveal: the element fades up the first time it enters the screen (styles: .reveal in main.css).
// Without IntersectionObserver, or when the device asks for less motion, it simply shows.
import type { Directive } from 'vue';

const seen = new WeakMap<Element, IntersectionObserver>();

export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') return;
    el.classList.add('reveal');
    if (binding.value) el.style.transitionDelay = `${binding.value}ms`;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          el.classList.add('revealed');
          io.disconnect();
          seen.delete(el);
        }
      },
      { rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    seen.set(el, io);
  },
  unmounted(el) {
    seen.get(el)?.disconnect();
    seen.delete(el);
  },
};

declare module 'vue' {
  interface GlobalDirectives {
    vReveal: typeof vReveal;
  }
}
