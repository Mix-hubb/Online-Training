<script setup lang="ts">
// Review moderation (spec 17): filter by course, status, stars or text; hide (with an optional reason),
// show again, or delete. Hidden reviews stay saved and visible to their author only.
// Stats on top (average, star breakdown, per course) follow the course filter.
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import StarRating from '@/components/review/StarRating.vue';
import ReviewStats from '@/components/review/ReviewStats.vue';
import * as api from '@/api/admin/reviews';
import { get, errorMessage } from '@/api/client';
import type { AdminCourseRow } from '@/api/admin/courses';
import type { Paged } from '@/types';
import { dateTime } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const q = ref({ courseId: String(route.query.course ?? ''), status: String(route.query.status ?? ''), rating: '', q: '', page: 1 });
const data = ref<(Paged<api.AdminReview> & { hidden: number }) | null>(null);
const courses = ref<AdminCourseRow[]>([]);
const err = ref('');
const busy = ref(false);
const hiding = ref<api.AdminReview | null>(null);
const reason = ref('');
const deleting = ref<api.AdminReview | null>(null);
const toast = ref('');
const stats = ref<api.ReviewStats | null>(null);
const courseTitle = computed(() => courses.value.find((c) => c.id === q.value.courseId)?.title);

async function load() {
  err.value = '';
  try {
    [data.value, stats.value] = await Promise.all([api.list(q.value), api.stats(q.value.courseId || undefined)]);
  } catch (e) {
    err.value = errorMessage(e);
  }
}
onMounted(async () => {
  void load();
  courses.value = (await get<Paged<AdminCourseRow>>('/admin/courses', { pageSize: 100 })).items;
});
let t: ReturnType<typeof setTimeout> | undefined;
watch(
  () => ({ ...q.value }),
  (now, before) => {
    if (now.page === before.page && now.page !== 1) return void (q.value.page = 1); // a filter changed: back to page 1
    void router.replace({ query: { ...(now.courseId ? { course: now.courseId } : {}), ...(now.status ? { status: now.status } : {}) } });
    clearTimeout(t);
    t = setTimeout(load, now.q !== before.q ? 300 : 0);
  },
);

function openHide(r: api.AdminReview) {
  hiding.value = r;
  reason.value = '';
}
async function confirmHide() {
  if (!hiding.value) return;
  busy.value = true;
  try {
    await api.setStatus(hiding.value.id, 'HIDDEN', reason.value.trim() || undefined);
    hiding.value = null;
    toast.value = 'Review hidden. It no longer shows on the course page.';
    await load();
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function show(r: api.AdminReview) {
  busy.value = true;
  try {
    await api.setStatus(r.id, 'VISIBLE');
    toast.value = 'Review is visible again.';
    await load();
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function confirmDelete() {
  if (!deleting.value) return;
  busy.value = true;
  try {
    await api.remove(deleting.value.id);
    deleting.value = null;
    toast.value = 'Review deleted.';
    await load();
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <AdminPageHeader title="Reviews" subtitle="What learners wrote after finishing a course. Hide anything abusive or off topic: it leaves the course page but stays saved." />

    <ReviewStats
      v-if="stats"
      :stats="stats"
      :rating="q.rating"
      :course-title="q.courseId ? courseTitle : undefined"
      @rating="(v) => (q.rating = v)"
      @course="(id) => (q.courseId = id)"
      @hidden="q.status = 'HIDDEN'"
    />
    <v-skeleton-loader v-else type="card" color="surface" height="140" />

    <div class="filters">
      <div class="grow2">
        <label for="r-q" class="sr-only">Search</label>
        <input id="r-q" v-model="q.q" type="search" class="ot-input" placeholder="Search text, learner name or email" />
      </div>
      <div class="grow2">
        <label for="r-c" class="sr-only">Course</label>
        <select id="r-c" v-model="q.courseId" class="ot-select">
          <option value="">All courses</option>
          <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option>
        </select>
      </div>
      <div class="grow1">
        <label for="r-s" class="sr-only">Status</label>
        <select id="r-s" v-model="q.status" class="ot-select">
          <option value="">Any status</option>
          <option value="VISIBLE">Visible</option>
          <option value="HIDDEN">Hidden</option>
        </select>
      </div>
      <div class="grow1">
        <label for="r-r" class="sr-only">Stars</label>
        <select id="r-r" v-model="q.rating" class="ot-select">
          <option value="">Any stars</option>
          <option v-for="n in [5, 4, 3, 2, 1]" :key="n" :value="String(n)">{{ n }} {{ n === 1 ? 'star' : 'stars' }}</option>
        </select>
      </div>
    </div>

    <v-alert v-if="err" type="error" variant="tonal" density="compact">{{ err }}</v-alert>
    <v-skeleton-loader v-if="!data" type="table" color="surface" />
    <template v-else>
      <div class="text-body-2 text-muted">{{ data.total }} {{ data.total === 1 ? 'review' : 'reviews' }}<template v-if="data.hidden"> · {{ data.hidden }} hidden</template></div>
      <div class="table-scroll">
        <table class="data-table" style="min-width: 880px">
          <caption class="sr-only">Reviews</caption>
          <thead>
            <tr>
              <th scope="col" style="width: 44%">Review</th>
              <th scope="col">Course</th>
              <th scope="col">Learner</th>
              <th scope="col">Status</th>
              <th scope="col" class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in data.items" :key="r.id" :class="{ muted: r.status === 'HIDDEN' }">
              <td>
                <div class="d-flex align-center ga-2 mb-1">
                  <StarRating :value="r.rating" :size="14" />
                  <span class="text-caption text-muted">{{ dateTime(r.createdAt) }}</span>
                </div>
                <p class="body ma-0">{{ r.body }}</p>
                <p v-if="r.hiddenReason" class="text-caption text-muted ma-0 mt-1">Hidden because: {{ r.hiddenReason }}</p>
              </td>
              <td style="min-width: 160px"><router-link :to="`/courses/${r.course.slug}#reviews`" class="row-link" target="_blank">{{ r.course.title }}</router-link></td>
              <td>
                <div class="font-weight-medium">{{ r.user.name }}</div>
                <div class="text-caption text-muted">{{ r.user.email }}</div>
              </td>
              <td><StatusPill :label="r.status === 'HIDDEN' ? 'Hidden' : 'Visible'" :tone="r.status === 'HIDDEN' ? 'warning' : 'success'" /></td>
              <td class="text-right text-no-wrap">
                <button v-if="r.status === 'VISIBLE'" type="button" class="row-link" :disabled="busy" @click="openHide(r)">Hide</button>
                <button v-else type="button" class="row-link" :disabled="busy" @click="show(r)">Show</button>
                <button type="button" class="row-link danger" :disabled="busy" @click="deleting = r">Delete</button>
              </td>
            </tr>
            <tr v-if="!data.items.length"><td colspan="5" class="text-center text-muted">No reviews match these filters.</td></tr>
          </tbody>
        </table>
      </div>
      <v-pagination v-if="data.pages > 1" v-model="q.page" :length="data.pages" density="comfortable" />
    </template>

    <v-dialog :model-value="!!hiding" max-width="480" @update:model-value="(v: boolean) => !v && (hiding = null)">
      <v-card color="surface">
        <v-card-title class="pt-5 px-6">Hide this review?</v-card-title>
        <v-card-text class="px-6 d-flex flex-column ga-3">
          <p class="text-body-2 text-muted ma-0">It leaves the course page and the rating. The learner still sees it, marked as hidden. You can show it again later.</p>
          <div class="d-flex flex-column ga-1">
            <label for="hide-reason" class="text-body-2 font-weight-medium">Reason (optional, for admins)</label>
            <input id="hide-reason" v-model="reason" class="ot-input" maxlength="500" placeholder="For example: spam, abusive, not about the course" />
          </div>
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="hiding = null">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="busy" @click="confirmHide">Hide review</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      :model-value="!!deleting"
      title="Delete this review?"
      text="The review is removed for good and the course rating updates. The learner can write a new one. To keep a record, hide it instead."
      confirm-label="Delete"
      danger
      :loading="busy"
      @update:model-value="(v: boolean) => !v && (deleting = null)"
      @confirm="confirmDelete"
    />
    <v-snackbar :model-value="!!toast" :timeout="4000" @update:model-value="toast = ''">{{ toast }}</v-snackbar>
  </div>
</template>

<style scoped>
.body {
  font-size: var(--ot-fs-sm);
  line-height: 1.55;
  white-space: pre-line;
  overflow-wrap: anywhere;
  color: var(--ot-text-2);
}
tr.muted td {
  background: var(--ot-raised);
}
tr.muted .body {
  color: var(--ot-muted);
}
.row-link + .row-link {
  margin-left: 4px;
}
</style>
