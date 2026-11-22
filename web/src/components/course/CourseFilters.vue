<script setup lang="ts">
// Search + category, level, price selects, and a row of topic (tag) toggles (mockup).
import type { Taxon } from '@/types';
import type { CourseQuery } from '@/api/catalog';

const model = defineModel<CourseQuery>({ required: true });
defineProps<{ categories: Taxon[]; tags: Taxon[] }>();

const levels = [
  { title: 'All levels', value: '' },
  { title: 'Beginner', value: 'BEGINNER' },
  { title: 'Intermediate', value: 'INTERMEDIATE' },
  { title: 'Advanced', value: 'ADVANCED' },
];
const prices = [
  { title: 'Free and paid', value: '' },
  { title: 'Free', value: 'free' },
  { title: 'Paid', value: 'paid' },
];
function set<K extends keyof CourseQuery>(k: K, v: CourseQuery[K]) {
  model.value = { ...model.value, [k]: v, page: 1 };
}
</script>

<template>
  <div class="d-flex flex-column ga-3">
    <div class="filter-row">
      <div class="f-search">
        <label for="cf-q" class="sr-only">Search courses</label>
        <svg class="mag" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input id="cf-q" :value="model.q" type="search" class="ot-input" placeholder="Search courses, e.g. hashboard" @input="set('q', ($event.target as HTMLInputElement).value)" />
      </div>
      <div class="f-sel wide">
        <label for="cf-cat" class="sr-only">Category</label>
        <select id="cf-cat" :value="model.category ?? ''" class="ot-select" @change="set('category', ($event.target as HTMLSelectElement).value)">
          <option value="">All categories</option>
          <option v-for="c in categories" :key="c.id" :value="c.slug">{{ c.name }}</option>
        </select>
      </div>
      <div class="f-sel">
        <label for="cf-lvl" class="sr-only">Level</label>
        <select id="cf-lvl" :value="model.level ?? ''" class="ot-select" @change="set('level', ($event.target as HTMLSelectElement).value)">
          <option v-for="l in levels" :key="l.value" :value="l.value">{{ l.title }}</option>
        </select>
      </div>
      <div class="f-sel">
        <label for="cf-price" class="sr-only">Price</label>
        <select id="cf-price" :value="model.price ?? ''" class="ot-select" @change="set('price', ($event.target as HTMLSelectElement).value as CourseQuery['price'])">
          <option v-for="p in prices" :key="p.value" :value="p.value">{{ p.title }}</option>
        </select>
      </div>
    </div>
    <div v-if="tags.length" class="d-flex flex-wrap align-center ga-2" role="group" aria-label="Topics">
      <span class="text-body-2 text-muted mr-1">Topics</span>
      <button type="button" class="topic" :class="{ on: !model.tag }" :aria-pressed="!model.tag" @click="set('tag', '')">All</button>
      <button
        v-for="t in tags"
        :key="t.id"
        type="button"
        class="topic"
        :class="{ on: model.tag === t.slug }"
        :aria-pressed="model.tag === t.slug"
        @click="set('tag', model.tag === t.slug ? '' : t.slug)"
      >
        {{ t.name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.f-search {
  flex: 2 1 320px;
  position: relative;
}
.f-search .ot-input {
  padding-left: 42px;
}
.mag {
  position: absolute;
  left: 14px;
  top: 50%;
  margin-top: -9px;
  color: var(--ot-muted);
  pointer-events: none;
}
.f-sel {
  flex: 1 1 140px;
}
.f-sel.wide {
  flex-basis: 160px;
}
.ot-input,
.ot-select {
  width: 100%;
  height: 46px;
}
.topic {
  font-size: var(--ot-fs-sm);
  padding: 0 var(--ot-space-2);
  border-radius: var(--ot-radius-control);
  border: 1px solid var(--ot-input-border);
  background: var(--ot-surface);
  color: var(--ot-muted);
  cursor: pointer;
  min-height: var(--ot-control-h);
  transition: background var(--ot-transition), border-color var(--ot-transition), color var(--ot-transition);
}
.topic:hover {
  border-color: var(--ot-info-border);
  background: var(--ot-accent-hover);
  color: var(--ot-text);
}
.topic.on {
  border-color: var(--ot-info-border);
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
  font-weight: 600;
}
.topic:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: 2px;
}
</style>
