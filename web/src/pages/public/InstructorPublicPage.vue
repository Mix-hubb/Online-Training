<script setup lang="ts">
// Public instructor profile (2026-11-27): about, areas of expertise, the documents the instructor chose to show
// (certificates and similar), and the published courses they teach.
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import CourseCard from '@/components/course/CourseCard.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import * as api from '@/api/instructors';
import { ApiError } from '@/api/client';
import type { PublicInstructor } from '@/types';
import { date, initials } from '@/utils/format';

const route = useRoute();
const p = ref<PublicInstructor | null>(null);
const missing = ref(false);
const failed = ref(false);
async function load() {
  p.value = null;
  missing.value = failed.value = false;
  try {
    p.value = await api.getOne(String(route.params.id));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) missing.value = true;
    else failed.value = true;
  }
}
watch(() => route.params.id, load, { immediate: true });
</script>

<template>
  <div class="page d-flex flex-column ga-8">
    <router-link :to="{ path: '/', hash: '#instructors' }" class="back">← All instructors</router-link>
    <EmptyState v-if="missing" class="panel" icon="mdi-account-off-outline" title="Instructor not found" text="This profile is not available." />
    <EmptyState v-else-if="failed" icon="mdi-cloud-alert-outline" title="The profile could not be loaded" text="Check your connection and try again." action-label="Try again" @action="load" />
    <v-skeleton-loader v-else-if="!p" type="list-item-avatar-three-line, paragraph, image" color="surface" />
    <template v-else>
      <section class="hero panel">
        <img v-if="p.avatarUrl" :src="p.avatarUrl" alt="" class="avatar" referrerpolicy="no-referrer" />
        <span v-else class="avatar ph" aria-hidden="true">{{ initials(p.name) }}</span>
        <div class="d-flex flex-column ga-2" style="min-width: 0">
          <h1 class="name">{{ p.name }}</h1>
          <p v-if="p.headline" class="headline">{{ p.headline }}</p>
          <div v-if="p.expertise.length" class="tags">
            <span v-for="t in p.expertise" :key="t" class="tag">{{ t }}</span>
          </div>
          <span v-if="p.approvedAt" class="text-caption text-muted">
            <v-icon icon="mdi-check-decagram-outline" size="14" class="mr-1" />Checked by our team · teaching since {{ date(p.approvedAt) }}
          </span>
        </div>
      </section>

      <div class="cols">
        <section v-if="p.bio" class="panel pad" aria-labelledby="about-h">
          <h2 id="about-h">About</h2>
          <p class="bio">{{ p.bio }}</p>
        </section>
        <section v-if="p.documents.length" class="panel pad" aria-labelledby="docs-h">
          <h2 id="docs-h">Certificates and documents</h2>
          <ul class="docs">
            <li v-for="d in p.documents" :key="d.id">
              <v-icon :icon="d.mime === 'application/pdf' ? 'mdi-file-pdf-box' : 'mdi-file-certificate-outline'" size="22" class="text-muted" />
              <a :href="d.url" target="_blank" rel="noopener">{{ d.title }}</a>
            </li>
          </ul>
        </section>
      </div>

      <section class="d-flex flex-column ga-4" aria-labelledby="courses-h">
        <h2 id="courses-h" class="sec">Courses by {{ p.name }}</h2>
        <EmptyState v-if="!p.courses.length" class="panel" icon="mdi-book-outline" title="No courses yet" text="New courses from this instructor will appear here." />
        <div v-else class="grid">
          <CourseCard v-for="c in p.courses" :key="c.id" :course="c" />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: var(--ot-control-h);
  font-size: var(--ot-fs-sm);
  color: var(--ot-muted);
  text-decoration: none;
}
.back:hover {
  color: var(--ot-text);
  text-decoration: underline;
}
.hero {
  padding: 32px;
  display: flex;
  align-items: center;
  gap: 28px;
}
.avatar {
  width: 112px;
  height: 112px;
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
  font-size: 36px;
  font-weight: 700;
}
.name {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.headline {
  margin: 0;
  font-size: 17px;
  color: var(--ot-muted);
  line-height: 1.5;
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
.cols {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.cols > :only-child {
  grid-column: 1 / -1;
}
.pad {
  padding: 24px;
}
.pad h2,
.sec {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 700;
}
.sec {
  margin: 0;
}
.bio {
  margin: 0;
  white-space: pre-line;
  line-height: 1.7;
}
.docs {
  list-style: none;
  margin: 0;
  padding: 0;
}
.docs li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--ot-border);
}
.docs li:first-child {
  border-top: 0;
}
.docs a {
  color: var(--ot-accent-strong);
  font-weight: 500;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}
@media (max-width: 800px) {
  .cols {
    grid-template-columns: 1fr;
  }
  .hero {
    flex-direction: column;
    text-align: center;
    padding: 24px;
  }
  .hero .tags {
    justify-content: center;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
