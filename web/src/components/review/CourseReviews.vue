<script setup lang="ts">
// Reviews on the course page (spec 17): rating summary, the learner's own review (write / edit / delete once
// the course is completed) and the list of visible reviews, newest first.
import { computed, nextTick, onMounted, ref } from 'vue';
import StarRating from './StarRating.vue';
import StarInput from './StarInput.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import * as reviewsApi from '@/api/reviews';
import { errorMessage } from '@/api/client';
import { date, initials, plural } from '@/utils/format';

const props = defineProps<{ slug: string; courseId: string; signedIn: boolean; enrollmentStatus: 'IN_PROGRESS' | 'COMPLETED' | null; preview?: boolean }>();
const emit = defineEmits<{ changed: [] }>();

const data = ref<reviewsApi.ReviewList | null>(null);
const more = ref(false);
const mine = ref<{ canReview: boolean; review: reviewsApi.MyReview | null } | null>(null);
const editing = ref(false);
const rating = ref(0);
const text = ref('');
const busy = ref(false);
const err = ref('');
const askDelete = ref(false);
const saved = ref('');

const MAX = 2000;
const bars = computed(() => {
  const s = data.value?.summary;
  return [5, 4, 3, 2, 1].map((n) => {
    const c = s?.distribution[String(n) as '1'] ?? 0;
    return { n, c, pct: s?.count ? Math.round((c / s.count) * 100) : 0 };
  });
});

async function loadList() {
  data.value = await reviewsApi.list(props.slug);
}
async function loadMine() {
  if (!props.signedIn || props.preview || !props.enrollmentStatus) return;
  try {
    mine.value = await reviewsApi.mine(props.courseId);
  } catch {
    mine.value = null;
  }
}
onMounted(async () => {
  await Promise.all([loadList(), loadMine()]);
  // Links like /courses/x#reviews (from the result page) arrive before this section exists.
  if (window.location.hash === '#reviews') {
    await nextTick();
    document.getElementById('reviews')?.scrollIntoView({ block: 'start' });
  }
});

async function loadMore() {
  if (!data.value) return;
  more.value = true;
  try {
    const next = await reviewsApi.list(props.slug, data.value.page + 1);
    data.value = { ...next, items: [...data.value.items, ...next.items] };
  } finally {
    more.value = false;
  }
}

function startEdit() {
  rating.value = mine.value?.review?.rating ?? 0;
  text.value = mine.value?.review?.body ?? '';
  err.value = '';
  saved.value = '';
  editing.value = true;
}

async function submit() {
  if (!rating.value) return void (err.value = 'Please choose a star rating.');
  if (!text.value.trim()) return void (err.value = 'Please write a few words about the course.');
  busy.value = true;
  err.value = '';
  try {
    const r = await reviewsApi.save(props.courseId, { rating: rating.value, body: text.value.trim() });
    mine.value = { canReview: true, review: r };
    editing.value = false;
    saved.value = 'Thank you. Your review is saved.';
    await loadList();
    emit('changed');
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function removeMine() {
  busy.value = true;
  try {
    await reviewsApi.remove(props.courseId);
    mine.value = { canReview: true, review: null };
    askDelete.value = false;
    saved.value = 'Your review was deleted.';
    await loadList();
    emit('changed');
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section id="reviews" class="panel pad" aria-labelledby="reviews-h">
    <div class="d-flex flex-wrap justify-space-between align-baseline ga-2">
      <h2 id="reviews-h">Learner reviews</h2>
      <span v-if="data?.summary.count" class="text-body-2 text-muted">{{ plural(data.summary.count, 'review') }}</span>
    </div>

    <v-skeleton-loader v-if="!data" type="paragraph" color="surface" />
    <template v-else>
      <div v-if="data.summary.count" class="summary">
        <div class="avg">
          <span class="avg-num">{{ data.summary.average?.toFixed(1) }}</span>
          <StarRating :value="data.summary.average" :size="20" />
          <span class="text-caption text-muted">Course rating</span>
        </div>
        <ul class="dist" aria-label="Rating breakdown">
          <li v-for="b in bars" :key="b.n">
            <span class="dist-label">{{ b.n }} <v-icon icon="mdi-star" size="12" aria-hidden="true" /></span>
            <span class="dist-bar" aria-hidden="true"><span :style="{ width: `${b.pct}%` }" /></span>
            <span class="dist-count text-muted">{{ b.c }}</span>
            <span class="sr-only">{{ plural(b.n, 'star') }}: {{ plural(b.c, 'review') }}</span>
          </li>
        </ul>
      </div>

      <!-- The learner's own review -->
      <div v-if="mine?.canReview" class="mine">
        <v-alert v-if="saved && !editing" type="success" variant="tonal" density="compact">{{ saved }}</v-alert>
        <form v-if="editing || !mine.review" class="d-flex flex-column ga-3" novalidate @submit.prevent="submit">
          <div class="text-body-1 font-weight-medium">{{ mine.review ? 'Edit your review' : 'You finished this course. How was it?' }}</div>
          <StarInput v-model="rating" />
          <div class="d-flex flex-column ga-1">
            <label for="review-text" class="text-body-2 font-weight-medium">Your review</label>
            <textarea id="review-text" v-model="text" class="ot-input area" rows="4" :maxlength="MAX" placeholder="What did you learn? Who would you recommend it to?" />
            <span class="text-caption text-muted text-right">{{ text.length }} / {{ MAX }}</span>
          </div>
          <v-alert v-if="err" type="error" variant="tonal" density="compact">{{ err }}</v-alert>
          <div class="d-flex flex-wrap ga-3">
            <v-btn type="submit" color="primary" :loading="busy">{{ mine.review ? 'Save changes' : 'Post review' }}</v-btn>
            <v-btn v-if="mine.review" variant="text" @click="editing = false">Cancel</v-btn>
          </div>
          <span class="text-caption text-muted">Your first name and last initial are shown with your review.</span>
        </form>
        <div v-else class="d-flex flex-column ga-2">
          <div class="d-flex flex-wrap align-center ga-2">
            <span class="text-body-2 font-weight-medium">Your review</span>
            <StarRating :value="mine.review.rating" />
          </div>
          <p class="body mb-0">{{ mine.review.body }}</p>
          <div v-if="mine.review.status === 'HIDDEN'" class="callout">An admin has hidden this review, so only you can see it. Contact support if you think this is a mistake.</div>
          <div class="d-flex flex-wrap ga-2">
            <v-btn variant="outlined" size="small" prepend-icon="mdi-pencil-outline" @click="startEdit">Edit</v-btn>
            <v-btn variant="text" size="small" color="error" @click="askDelete = true">Delete</v-btn>
          </div>
        </div>
      </div>
      <p v-else-if="enrollmentStatus === 'IN_PROGRESS'" class="text-body-2 text-muted mb-0">Finish the course to leave a review.</p>

      <ul v-if="data.items.length" class="list">
        <li v-for="r in data.items" :key="r.id" class="item">
          <span class="avatar" aria-hidden="true">{{ initials(r.author) }}</span>
          <div class="d-flex flex-column ga-1" style="min-width: 0">
            <div class="d-flex flex-wrap align-center ga-2">
              <span class="font-weight-medium">{{ r.author }}</span>
              <StarRating :value="r.rating" :size="14" />
              <span class="text-caption text-muted">{{ date(r.createdAt) }}{{ r.edited ? ' · edited' : '' }}</span>
            </div>
            <p class="body mb-0">{{ r.body }}</p>
          </div>
        </li>
      </ul>
      <p v-else-if="!mine?.canReview" class="text-body-2 text-muted mb-0">No reviews yet. Learners can review the course after they finish it.</p>
      <div v-if="data.page < data.pages">
        <v-btn variant="outlined" :loading="more" @click="loadMore">Show more reviews</v-btn>
      </div>
    </template>

    <ConfirmDialog v-model="askDelete" title="Delete your review?" text="Your rating and text will be removed. You can write a new review later." confirm-label="Delete" danger :loading="busy" @confirm="removeMine" />
  </section>
</template>

<style scoped>
.pad {
  scroll-margin-top: 96px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 40px;
}
.avg {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.avg-num {
  font-family: var(--ot-font-display);
  font-size: 44px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}
.dist {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1 1 260px;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dist li {
  display: grid;
  grid-template-columns: 34px 1fr 32px;
  align-items: center;
  gap: 10px;
  font-size: var(--ot-fs-sm);
}
.dist-label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--ot-text-2);
}
.dist-label .v-icon {
  color: var(--ot-star);
}
.dist-bar {
  height: 8px;
  border-radius: var(--ot-radius-pill);
  background: var(--ot-border);
  overflow: hidden;
}
.dist-bar > span {
  display: block;
  height: 100%;
  background: var(--ot-star);
}
.dist-count {
  text-align: right;
}
.mine {
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-card);
  background: var(--ot-raised);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.area {
  height: auto;
  min-height: 112px;
  padding: 10px 14px;
  line-height: 1.55;
  resize: vertical;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.item {
  display: flex;
  gap: 14px;
  padding: 16px 0;
  border-top: 1px solid var(--ot-border);
}
.item:first-child {
  border-top: 0;
  padding-top: 4px;
}
.avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: var(--ot-thumb);
  color: var(--ot-accent-strong);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}
.body {
  font-size: var(--ot-fs-sm);
  line-height: 1.65;
  color: var(--ot-text-2);
  white-space: pre-line;
  overflow-wrap: anywhere;
}
@media (max-width: 600px) {
  .pad {
    padding: 20px;
  }
}
</style>
