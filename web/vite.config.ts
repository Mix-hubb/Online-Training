import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  // Scan every page at startup so Vuetify components are pre-bundled once
  // (otherwise dev reloads the page the first time each component is used).
  optimizeDeps: { entries: ['index.html', 'src/**/*.vue'] },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
