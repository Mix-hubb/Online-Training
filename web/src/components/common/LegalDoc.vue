<script setup lang="ts">
// Shared layout for the Terms and Privacy pages: title, last-updated line, contents list, sections.
// Text in [brackets] is a placeholder for the company to fill in. Legal review is needed before launch.
export interface LegalSection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
}

defineProps<{ title: string; updated: string; intro: string; sections: LegalSection[] }>();
const isDev = import.meta.env.DEV;
</script>

<template>
  <div class="page narrow legal">
    <div v-if="isDev" class="callout warning mb-6">
      <v-icon icon="mdi-alert-outline" size="20" />
      <span>Draft text. Fill in the [bracketed] items and have it checked by a lawyer before launch. (Shown in development only.)</span>
    </div>

    <h1 class="page-title">{{ title }}</h1>
    <p class="page-sub">Last updated: {{ updated }}</p>
    <p class="intro">{{ intro }}</p>

    <nav class="panel toc" aria-label="Contents">
      <div class="toc-title">Contents</div>
      <ol>
        <li v-for="s in sections" :key="s.id"><a :href="`#${s.id}`">{{ s.title }}</a></li>
      </ol>
    </nav>

    <section v-for="(s, i) in sections" :id="s.id" :key="s.id" class="legal-section">
      <h2>{{ i + 1 }}. {{ s.title }}</h2>
      <p v-for="(p, j) in s.paragraphs ?? []" :key="j">{{ p }}</p>
      <ul v-if="s.items?.length">
        <li v-for="(it, j) in s.items" :key="j">{{ it }}</li>
      </ul>
    </section>

    <slot />
  </div>
</template>

<style scoped>
.legal {
  line-height: 1.7;
  color: var(--ot-text);
}
.intro {
  margin: 20px 0 24px;
  font-size: 15px;
  color: var(--ot-muted);
}
.toc {
  padding: 18px 22px;
  margin-bottom: 32px;
}
.toc-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.toc ol {
  margin: 0;
  padding-left: 20px;
  columns: 2 240px;
  font-size: 14px;
}
.toc a {
  color: var(--ot-accent);
  text-decoration: none;
}
.toc a:hover {
  text-decoration: underline;
}
.legal-section {
  scroll-margin-top: 80px;
  margin-bottom: 28px;
}
.legal-section h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 10px;
}
.legal-section p {
  margin: 0 0 10px;
  font-size: 15px;
}
.legal-section ul {
  margin: 0 0 10px;
  padding-left: 22px;
  font-size: 15px;
}
.legal-section li {
  margin-bottom: 6px;
}
</style>
