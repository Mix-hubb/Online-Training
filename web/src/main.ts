import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@mdi/font/css/materialdesignicons.css';
import './styles/main.css';

import App from './App.vue';
import { router } from './router';
import { vuetify } from './plugins/vuetify';
import { apiHooks } from './api/client';
import { useAuthStore } from './stores/auth';
import { vReveal } from './directives/reveal';

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

app.mount('#app');
