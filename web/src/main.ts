import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@mdi/font/css/materialdesignicons.css';
import './styles/main.css';

import App from './App.vue';
import { router } from './router';
import { vuetify } from './plugins/vuetify';
import { apiHooks } from './api/client';
import { useAuthStore } from './stores/auth';

const app = createApp(App).use(createPinia()).use(router).use(vuetify);

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
