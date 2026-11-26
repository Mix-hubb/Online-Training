import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './styles/main.css';

import App from './App.vue';
import { router } from './router';
import { vuetify } from './plugins/vuetify';
import { apiHooks } from './api/client';
import { useAuthStore } from './stores/auth';
import { vReveal } from './directives/reveal';
import { installErrorHandlers } from './utils/appErrors';
import { useLanding } from './composables/useLanding';

const app = createApp(App).use(createPinia()).use(router).use(vuetify).directive('reveal', vReveal);

apiHooks.onAuthError = (code) => {
  const auth = useAuthStore();
  if (code === 'BANNED') {
    auth.setUser(null);
    void router.push({ name: 'login', query: { banned: '1' } });
  } else if (code === 'MUST_CHANGE_PASSWORD') {
    void router.push({ name: 'change-password' });
  }
};

installErrorHandlers(app, router);

// Start the first page's work at once, in parallel, instead of one after another (2026-11-26):
// the router would otherwise wait for /auth/me before it even downloads the page's code, and the footer's
// /landing request would only start after the page has rendered. These are the same calls the app makes
// anyway (each is shared, so nothing is fetched twice).
void useAuthStore().ensureLoaded();
const first = router.resolve(window.location.pathname + window.location.search);
for (const r of first.matched) {
  const c = r.components?.default;
  if (typeof c === 'function') void (c as () => Promise<unknown>)().catch(() => undefined);
}
if (!/^\/(admin|instructor|partner)(\/|$)/.test(window.location.pathname)) void useLanding().load();

app.mount('#app');
