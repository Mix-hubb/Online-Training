import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';

/**
 * Adds <link rel="preconnect"> to the API origin (2026-11-26): the browser opens the connection (DNS + TLS)
 * while the app's JavaScript is still downloading, so the first API call does not wait for it.
 * Same normalisation as src/api/client.ts (adds https://, drops a trailing slash). Nothing is added when the
 * value is missing or not a valid URL.
 */
function preconnectApi(mode: string): Plugin {
  const raw = (loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL ?? '').trim().replace(/\/+$/, '');
  let origin = '';
  try {
    if (raw) origin = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin;
  } catch {
    origin = '';
  }
  return {
    name: 'preconnect-api',
    transformIndexHtml: () => (origin ? [{ tag: 'link', attrs: { rel: 'preconnect', href: origin, crossorigin: 'use-credentials' }, injectTo: 'head' }] : []),
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [vue(), vuetify({ autoImport: true }), preconnectApi(mode)],
  // Scan every page at startup so Vuetify components are pre-bundled once
  // (otherwise dev reloads the page the first time each component is used).
  optimizeDeps: { entries: ['index.html', 'src/**/*.vue'] },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
}));
