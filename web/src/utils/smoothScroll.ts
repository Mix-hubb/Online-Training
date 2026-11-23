// Animated page scroll that does not depend on the browser's `behavior: 'smooth'`.
// Browsers turn native smooth scrolling into an instant jump when the OS has animations off
// (prefers-reduced-motion), which made "Browse courses" warp instead of glide.
// A short tween is used instead; the user scrolling (wheel/touch/keys) cancels it.
let cancel: (() => void) | null = null;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function smoothScrollTo(top: number, duration = 700): Promise<void> {
  cancel?.();
  const start = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const end = Math.max(0, Math.min(top, max));
  const dist = end - start;
  if (Math.abs(dist) < 2) return Promise.resolve();
  // Longer trips get a little more time, capped so it never feels slow.
  const ms = Math.min(1000, duration + Math.abs(dist) / 20);

  return new Promise((resolve) => {
    let raf = 0;
    const t0 = performance.now();
    const stopEvents = ['wheel', 'touchstart', 'keydown'] as const;
    const stop = () => {
      cancelAnimationFrame(raf);
      stopEvents.forEach((e) => window.removeEventListener(e, stop));
      cancel = null;
      resolve();
    };
    stopEvents.forEach((e) => window.addEventListener(e, stop, { passive: true }));
    cancel = stop;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      window.scrollTo(0, start + dist * ease(p));
      if (p < 1) raf = requestAnimationFrame(step);
      else stop();
    };
    raf = requestAnimationFrame(step);
  });
}
