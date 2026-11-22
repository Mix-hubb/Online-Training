// ESLint (flat config): Vue 3 recommended rules + TypeScript. Formatting is not linted.
import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';

export default defineConfigWithVueTs(
  { ignores: ['dist/**', 'node_modules/**', '*.tsbuildinfo'] },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    rules: {
      // Layout and formatting are left to the code style already in the files.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/attributes-order': 'off',
      // Page names like HomePage are fine as single words in this app.
      'vue/multi-word-component-names': 'off',
      // Unused args prefixed with _ are intentional (e.g. dropping fields with destructuring).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
);
