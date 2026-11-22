<script setup lang="ts">
// Player (spec 6.3): HLS video + quality menu, lesson sidebar with locks, progress every 10 s,
// next lesson unlocks at 90 % watched. Admin/instructor open it in preview mode (no progress saved).
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import LessonSidebar from '@/components/learn/LessonSidebar.vue';
import QualityMenu from '@/components/learn/QualityMenu.vue';
import * as learningApi from '@/api/learning';
import { ApiError } from '@/api/client';
import { useHls } from '@/composables/useHls';
import { useProgressReporter } from '@/composables/useProgressReporter';
import type { LearnData, LearnLesson } from '@/types';
import { duration } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const slug = String(route.params.slug);
const data = ref<LearnData | null>(null);
const currentId = ref<string | null>(null);
const video = ref<HTMLVideoElement | null>(null);
const videoMsg = ref<string | null>(null);
const unlockedToast = ref('');
const { load: loadHls, levels, current, setQuality, error: hlsError } = useHls(video);

const lesson = computed<LearnLesson | null>(() => data.value?.lessons.find((l) => l.id === currentId.value) ?? null);
const index = computed(() => (data.value && lesson.value ? data.value.lessons.indexOf(lesson.value) : -1));
const next = computed(() => (data.value && index.value >= 0 ? data.value.lessons[index.value + 1] ?? null : null));
const prev = computed(() => (data.value && index.value > 0 ? data.value.lessons[index.value - 1] : null));
const done = computed(() => data.value?.lessons.filter((l) => l.completed).length ?? 0);
const watchedPct = computed(() => {
  const l = lesson.value;
  if (!l || !l.durationSec) return 0;
  return l.completed ? 100 : Math.min(100, Math.round((l.watchedSec / l.durationSec) * 100));
});
const percent = computed(() => (data.value?.lessons.length ? Math.round((done.value / data.value.lessons.length) * 100) : 0));

const reporter = useProgressReporter(video, async (r) => {
  const l = lesson.value;
  if (!l) return;
  const wasDone = l.completed;
  l.watchedSec = r.watchedSec;
  l.completed = r.completed;
  if (!wasDone && r.completed) {
    await refresh();
    unlockedToast.value = next.value ? `Lesson complete. "${next.value.title}" is now open.` : data.value?.quiz?.unlocked ? 'All lessons complete. The final test is open.' : 'Lesson complete.';
  }
});

async function refresh() {
  data.value = await learningApi.learn(slug);
}

async function open(id: string) {
  const l = data.value?.lessons.find((x) => x.id === id);
  if (!l || !l.unlocked) return;
  currentId.value = id;
  void router.replace({ query: { lesson: id } });
  videoMsg.value = null;
  if (l.videoStatus !== 'READY') {
    videoMsg.value = l.videoStatus === 'FAILED' ? 'This video could not be processed. Please contact support.' : 'This video is still processing. Please check back soon.';
    return;
  }
  try {
    const p = await learningApi.play(id);
    await nextTick();
    loadHls(p.url, p.resumeAt, p.qualities);
    if (!data.value?.preview) reporter.attach(id);
  } catch {
    videoMsg.value = 'The video could not be loaded.';
  }
}

onMounted(async () => {
  try {
    await refresh();
  } catch (e) {
    if (e instanceof ApiError && e.code === 'NOT_ENROLLED') return void router.replace(`/courses/${slug}`);
    return void router.replace({ name: 'course-unavailable' });
  }
  const d = data.value!;
  const wanted = String(route.query.lesson ?? d.enrollment?.lastLessonId ?? '');
  const pick = d.lessons.find((l) => l.id === wanted && l.unlocked) ?? d.lessons.find((l) => l.unlocked && !l.completed) ?? d.lessons[0];
  if (pick) await open(pick.id);
});
</script>

<template>
  <div v-if="!data" class="page"><v-skeleton-loader type="image, heading" color="surface" /></div>
  <div v-else class="learn">
    <div v-if="data.preview" class="callout mb-2">Preview mode: progress is not saved.</div>
    <div class="top">
      <div class="d-flex flex-column ga-1" style="min-width: 0">
        <router-link :to="`/courses/${slug}`" class="back">← {{ data.course.title }}</router-link>
        <h1 class="lesson-title">{{ lesson ? `Lesson ${index + 1} · ${lesson.title}` : 'Choose a lesson' }}</h1>
      </div>
      <div class="d-flex align-center ga-3 prog">
        <span class="bar lg" role="progressbar" aria-label="Course progress" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${percent}%` }" /></span>
        <span class="text-body-2 text-muted text-no-wrap">{{ done }} of {{ data.lessons.length }} done · {{ percent }}%</span>
      </div>
    </div>

    <div class="cols">
      <section class="main-col" aria-label="Lesson player">
        <div class="player-box">
          <div class="player">
            <video v-show="!videoMsg && !hlsError" ref="video" controls playsinline controlslist="nodownload" class="w-100 d-block" @contextmenu.prevent />
            <div v-if="videoMsg || hlsError" class="msg d-flex flex-column align-center justify-center text-center pa-6">
              <v-icon icon="mdi-video-off-outline" size="40" class="mb-3" />
              <div class="text-body-1">{{ videoMsg ?? hlsError }}</div>
            </div>
          </div>
          <div class="player-bar">
            <span v-if="lesson">{{ duration(lesson.durationSec) }}</span>
            <span class="ml-auto d-flex align-center ga-2">
              <span class="text-caption text-muted">Quality</span>
              <QualityMenu v-if="levels.length > 1" :levels="levels" :current="current" @select="setQuality" />
              <span v-else class="text-caption text-muted">Auto</span>
            </span>
          </div>
        </div>

        <div v-if="lesson && !data.preview" class="callout" :class="{ success: lesson.completed }">
          <v-icon :icon="lesson.completed ? 'mdi-check-circle-outline' : 'mdi-clock-outline'" size="18" :color="lesson.completed ? 'success' : 'primary'" />
          <span class="flex-grow-1 text-2">{{ lesson.completed ? 'Lesson complete. The next lesson is open.' : 'Watch at least 90% of this lesson to unlock the next one.' }}</span>
          <span class="text-body-2 text-muted text-no-wrap">Watched {{ watchedPct }}%</span>
        </div>

        <div class="d-flex flex-wrap ga-3 justify-space-between">
          <v-btn v-if="prev" variant="outlined" size="large" @click="open(prev.id)">← Previous lesson</v-btn>
          <span v-else />
          <v-btn v-if="next" color="primary" size="large" :disabled="!next.unlocked" @click="open(next.id)">Next lesson →</v-btn>
          <v-btn v-else-if="data.quiz" color="primary" size="large" :disabled="!data.quiz.unlocked" :to="`/learn/${slug}/quiz`">Final test →</v-btn>
        </div>

        <section v-if="lesson?.description || lesson?.attachmentUrls.length" class="panel pad">
          <h2>About this lesson</h2>
          <p v-if="lesson?.description" class="text-body-2 text-muted mb-0" style="white-space: pre-line; line-height: 1.65">{{ lesson.description }}</p>
          <div v-if="lesson?.attachmentUrls.length" class="d-flex flex-wrap ga-2">
            <v-btn v-for="(u, i) in lesson.attachmentUrls" :key="u" :href="u" target="_blank" rel="noopener" size="small" variant="outlined" prepend-icon="mdi-paperclip">Attachment {{ i + 1 }}</v-btn>
          </div>
        </section>

        <section v-if="!data.preview" class="panel pad" aria-labelledby="ask-h">
          <div class="d-flex flex-wrap align-center justify-space-between ga-2">
            <h2 id="ask-h">Ask your instructor</h2>
            <span class="text-caption text-muted">Private: only you and the instructors see it</span>
          </div>
          <p class="text-body-2 text-muted mb-0">Stuck on something? Send a question with up to 3 photos.</p>
          <div><v-btn color="primary" prepend-icon="mdi-message-outline" :to="{ name: 'messages', query: { course: data.course.id } }">Ask a question</v-btn></div>
        </section>
      </section>

      <aside class="side panel" aria-label="Course lessons">
        <div class="side-head">Course content</div>
        <LessonSidebar :data="data" :current-id="currentId" :slug="slug" @select="open" />
      </aside>
    </div>
    <v-snackbar :model-value="!!unlockedToast" @update:model-value="unlockedToast = ''" :timeout="5000">{{ unlockedToast }}</v-snackbar>
  </div>
</template>

<style scoped>
.learn {
  max-width: var(--ot-page-max);
  margin: 0 auto;
  padding: 24px var(--ot-gutter) 64px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: var(--ot-control-h);
  font-size: var(--ot-fs-sm);
  color: var(--ot-muted);
  text-decoration: none;
  transition: color var(--ot-transition);
}
.back:hover {
  color: var(--ot-text);
  text-decoration: underline;
}
.lesson-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}
.prog {
  min-width: 260px;
}
.bar {
  flex: 1;
  height: 6px;
  border-radius: var(--ot-radius-pill);
  background: var(--ot-border);
  overflow: hidden;
}
.bar.lg {
  height: 8px;
  border-radius: var(--ot-radius-control);
}
.bar > span {
  display: block;
  height: 100%;
  background: var(--ot-accent);
}
.cols {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;
}
.main-col {
  flex: 999 1 600px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.player-box {
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-card);
  overflow: hidden;
  box-shadow: var(--ot-shadow-card);
}
.player {
  background: var(--ot-video-bg);
  aspect-ratio: 16 / 9;
  max-height: calc(100vh - 220px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.player video {
  max-height: 100%;
  height: 100%;
}
.msg {
  width: 100%;
  height: 100%;
  color: var(--ot-video-text);
}
.player-bar {
  background: var(--ot-deep);
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: var(--ot-text-2);
}
.pad {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.side {
  flex: 1 1 320px;
  max-width: 420px;
  overflow: hidden;
  position: sticky;
  top: 96px;
}
.side-head {
  padding: 16px 20px;
  border-bottom: 1px solid var(--ot-border);
  font-size: 15px;
  font-weight: 600;
}
@media (max-width: 960px) {
  .side {
    max-width: none;
    position: static;
  }
}
@media (max-width: 600px) {
  .learn {
    padding: 16px 16px 48px;
  }
}
</style>
