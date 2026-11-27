<script setup lang="ts">
// Instructor cards on the home page (2026-11-27, #instructors; the header link scrolls here).
// A card per approved instructor; click one for their profile, public documents and courses.
import { onMounted, ref, watch } from 'vue';
import EmptyState from '@/components/common/EmptyState.vue';
import * as api from '@/api/instructors';
import type { InstructorCard, Paged } from '@/types';
import { initials, plural } from '@/utils/format';

const q = ref('');
const page = ref(1);
const data = ref<Paged<InstructorCard> | null>(null);
const failed = ref(false);
async function load() {
  failed.value = false;
  try {
    data.value = await api.list({ q: q.value.trim() || undefined, page: page.value });
  } catch {
    failed.value = true;
  }
}
onMounted(load);
let t: ReturnType<typeof setTimeout> | undefined;
watch(q, () => {
  page.value = 1;
  clearTimeout(t);
  t = setTimeout(load, 250);
});
watch(page, async () => {
  await load();
  document.getElementById('instructors')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
</script>

<template>
  <section id="instructors" tabindex="-1" aria-labelledby="instructors-h" class="d-flex flex-column ga-5">
    <header class="d-flex flex-wrap align-end justify-space-between ga-4">
      <div>
        <h2 id="instructors-h" class="title">Our instructors</h2>
        <p class="ma-0 mt-1 text-body-1 text-muted">The people who teach our courses. Each one was checked by our team.</p>
      </div>
      <div class="search">
        <label for="ins-q" class="sr-only">Search instructors</label>
        <input id="ins-q" v-model="q" type="search" class="ot-input" placeholder="Search by name or subject" />
      </div>
    </header>

    <div v-if="!data && !failed" class="grid">
      <v-skeleton-loader v-for="i in 6" :key="i" type="list-item-avatar-two-line, paragraph" color="surface" class="panel" />
    </div>
    <EmptyState v-else-if="failed" icon="mdi-cloud-alert-outline" title="Instructors could not be loaded" text="Check your connection and try again." action-label="Try again" @action="load" />
    <EmptyState
      v-else-if="data && !data.items.length"
      class="panel"
      icon="mdi-account-search-outline"
      :title="q ? 'No instructors match' : 'No instructors yet'"
      :text="q ? 'Try a different name or subject.' : 'Instructors appear here once they are approved.'"
    />
    <template v-else-if="data">
      <ul class="grid">
        <li v-for="i in data.items" :key="i.id">
          <router-link :to="`/instructors/${i.id}`" class="card panel">
            <div class="d-flex align-center ga-4">
              <img v-if="i.avatarUrl" :src="i.avatarUrl" alt="" class="avatar" referrerpolicy="no-referrer" />
              <span v-else class="avatar ph" aria-hidden="true">{{ initials(i.name) }}</span>
              <div style="min-width: 0">
                <div class="name">{{ i.name }}</div>
                <div class="text-body-2 text-muted">{{ plural(i.courseCount, 'course') }}</div>
              </div>
            </div>
            <p class="headline">{{ i.headline }}</p>
            <div v-if="i.expertise.length" class="tags">
              <span v-for="t in i.expertise.slice(0, 4)" :key="t" class="tag">{{ t }}</span>
              <span v-if="i.expertise.length > 4" class="tag">+{{ i.expertise.length - 4 }}</span>
            </div>
            <span class="more">View profile →</span>
          </router-link>
        </li>
      </ul>
      <v-pagination v-if="data.pages > 1" v-model="page" :length="data.pages" density="comfortable" />
    </template>
  </section>
</template>

<style scoped>
#instructors {
  scroll-margin-top: 88px;
}
#instructors:focus {
  outline: none;
}
.title {
  margin: 0;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.search {
  flex: 0 1 340px;
  min-width: 220px;
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}
.card {
  height: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: inherit;
  text-decoration: none;
  transition: box-shadow var(--ot-transition), transform var(--ot-transition);
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ot-shadow-hover, var(--ot-shadow-card));
}
.card:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: 2px;
}
.avatar {
  width: 64px;
  height: 64px;
  flex: none;
  border-radius: 50%;
  object-fit: cover;
}
.avatar.ph {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
  font-size: 20px;
  font-weight: 700;
}
.name {
  font-size: 18px;
  font-weight: 700;
}
.headline {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag {
  padding: 2px 10px;
  border-radius: var(--ot-radius-pill);
  background: var(--ot-deep);
  color: var(--ot-muted);
  font-size: 12px;
  font-weight: 500;
}
.more {
  margin-top: auto;
  color: var(--ot-accent-strong);
  font-weight: 600;
  font-size: 14px;
}
@media (max-width: 600px) {
  .title {
    font-size: 26px;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
