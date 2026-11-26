// Global error safety net (2026-11-26). Pages handle their own expected errors; this catches the rest:
// - errors thrown while rendering or in a component hook (app.config.errorHandler)
// - promises nobody awaited or caught (window 'unhandledrejection')
// - a page chunk that no longer exists after a new deploy (router.onError): reload once to get the new build
// The message shows in one snackbar in App.vue instead of a blank or frozen page.
import { ref, type App } from 'vue';
import type { Router } from 'vue-router';
import { ApiError } from '@/api/client';

export const appError = ref<{ text: string; at: number } | null>(null);

/** Handled elsewhere (main.ts apiHooks), or not an error the user needs to see. */
const QUIET = new Set(['BANNED', 'MUST_CHANGE_PASSWORD', 'UNAUTHENTICATED']);

function show(err: unknown) {
  if (err instanceof ApiError && QUIET.has(err.code)) return;
  if (err instanceof DOMException && err.name === 'AbortError') return;
  const text = err instanceof ApiError ? err.message : 'Something went wrong. Please refresh the page and try again.';
  appError.value = { text, at: Date.now() };
}

/**
 * A rejection the user should hear about: our own API errors, or an Error thrown by this app's code.
 * Third-party scripts on the page (Google sign-in, browser extensions) reject promises of their own;
 * those are only logged, since the user can do nothing about them and the page still works.
 */
function isOurs(reason: unknown): boolean {
  if (reason instanceof ApiError) return true;
  if (!(reason instanceof Error)) return false;
  const top = (reason.stack ?? '').split('\n').find((l) => /https?:\/\//.test(l)) ?? '';
  return top.includes(window.location.origin);
}

const CHUNK_FAILED = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
const RELOAD_KEY = 'ot-chunk-reload';

export function installErrorHandlers(app: App, router: Router) {
  app.config.errorHandler = (err, _instance, info) => {
    console.error(`Unhandled error (${info}):`, err);
    show(err);
  };
  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    if (isOurs(e.reason)) show(e.reason);
  });
  router.onError((err, to) => {
    if (err instanceof Error && CHUNK_FAILED.test(err.message)) {
      // Reload at most once per minute, or a broken deploy would loop.
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
      } catch {
        /* storage blocked */
      }
      if (Date.now() - last > 60_000) {
        try {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        } catch {
          /* storage blocked */
        }
        window.location.assign(to.fullPath);
        return;
      }
    }
    console.error('Navigation failed:', err);
    show(err);
  });
}
