<script setup lang="ts">
// One instructor (2026-11-24): opened from a row on the Instructors page.
// Shows the account, the courses they are assigned to (share, co-instructor, learners, rating, earned)
// and their earnings. Assignments and shares are still changed in the course editor's Instructors tab.
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import StarRating from '@/components/review/StarRating.vue';
import * as api from '@/api/admin/instructors';
import { errorMessage } from '@/api/client';
import { date, initials, money, percentBp, plural, priceLabel } from '@/utils/format';

const route = useRoute();
const data = ref<api.InstructorDetail | null>(null);
const err = ref('');

async function load() {
  err.value = '';
  data.value = null;
  try {
    data.value = await api.getInstructor(String(route.params.id));
  } catch (e) {
    err.value = errorMessage(e);
  }
}
watch(() => route.params.id, load, { immediate: true });

const courseTone = (s: string) => (s === 'PUBLISHED' ? 'success' : s === 'DRAFT' ? 'warning' : 'neutral');
const courseLabel = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const learners = computed(() => data.value?.courses.reduce((a, c) => a + c.learners, 0) ?? 0);
const published = computed(() => data.value?.courses.filter((c) => c.status === 'PUBLISHED').length ?? 0);
const fmtAvg = (a: number | null) => (a === null ? '–' : a.toFixed(1));
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6">
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <v-skeleton-loader v-else-if="!data" type="heading, table" color="surface" />
    <template v-else>
      <AdminPageHeader :title="data.name" back="/admin/instructors" class="mb-0">
        <StatusPill :label="data.status === 'BANNED' ? 'Banned' : 'Active'" :tone="data.status === 'BANNED' ? 'danger' : 'success'" />
      </AdminPageHeader>

      <div class="panel pa-5 d-flex align-center ga-4 flex-wrap">
        <img v-if="data.avatarUrl" :src="data.avatarUrl" alt="" class="avatar" referrerpolicy="no-referrer" />
        <span v-else class="avatar ph" aria-hidden="true">{{ initials(data.name) }}</span>
        <dl class="facts">
          <div><dt>Email</dt><dd>{{ data.email }}</dd></div>
          <div><dt>Instructor since</dt><dd>{{ date(data.createdAt) }}</dd></div>
          <div><dt>Password</dt><dd>{{ data.mustChangePassword ? 'Temporary, not changed yet' : 'Set by instructor' }}</dd></div>
        </dl>
      </div>

      <div class="tiles">
        <div class="stat panel">
          <span class="stat-label">Courses</span>
          <span class="stat-value">{{ data.courses.length }}</span>
          <span class="stat-note">{{ published }} published</span>
        </div>
        <div class="stat panel">
          <span class="stat-label">Learners</span>
          <span class="stat-value">{{ learners }}</span>
          <span class="stat-note">Across their courses</span>
        </div>
        <div class="stat panel">
          <span class="stat-label">Earned</span>
          <span v-if="!data.earnings.length" class="stat-value">–</span>
          <span v-for="e in data.earnings" :key="e.currency" class="stat-value sm">{{ money(e.earnedMinor, e.currency) }}</span>
          <span class="stat-note">All time</span>
        </div>
        <div class="stat panel">
          <span class="stat-label">Unpaid</span>
          <span v-if="!data.earnings.some((e) => e.unpaidMinor > 0)" class="stat-value">–</span>
          <template v-for="e in data.earnings" :key="e.currency">
            <span v-if="e.unpaidMinor > 0" class="stat-value sm">{{ money(e.unpaidMinor, e.currency) }}</span>
          </template>
          <router-link to="/admin/revenue" class="stat-note">Pay on the Revenue page</router-link>
        </div>
      </div>

      <section class="d-flex flex-column ga-3" aria-labelledby="h-courses">
        <h2 id="h-courses" class="ptitle">Assigned courses</h2>
        <div v-if="!data.courses.length" class="panel pa-8 text-center text-body-2 text-muted">
          Not assigned to any course yet. Assign them in a course's Instructors tab.
        </div>
        <div v-else class="table-scroll">
          <table class="data-table" style="min-width: 900px">
            <caption class="sr-only">Assigned courses</caption>
            <thead>
              <tr>
                <th scope="col">Course</th>
                <th scope="col">Share</th>
                <th scope="col">Co-instructor</th>
                <th scope="col" class="text-right">Learners</th>
                <th scope="col">Rating</th>
                <th scope="col" class="text-right">Earned</th>
                <th scope="col">Assigned</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in data.courses" :key="c.id">
                <td>
                  <div class="d-flex align-center ga-3">
                    <img v-if="c.thumbnailUrl" :src="c.thumbnailUrl" alt="" class="thumb" loading="lazy" />
                    <span v-else class="thumb thumb-ph" aria-hidden="true" />
                    <div>
                      <router-link :to="`/admin/courses/${c.id}`" class="font-weight-medium">{{ c.title }}</router-link>
                      <div class="d-flex align-center ga-2 mt-1">
                        <StatusPill :label="courseLabel(c.status)" :tone="courseTone(c.status)" />
                        <span class="text-caption text-muted">{{ priceLabel(c) }}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="text-no-wrap font-weight-medium">{{ c.sharePercentBp ? percentBp(c.sharePercentBp) : 'No share' }}</td>
                <td>
                  <span v-if="!c.coInstructors.length" class="text-muted">–</span>
                  <div v-for="o in c.coInstructors" :key="o.id">
                    <router-link :to="`/admin/instructors/${o.id}`">{{ o.name }}</router-link>
                    <span class="text-muted"> · {{ o.sharePercentBp ? percentBp(o.sharePercentBp) : 'no share' }}</span>
                  </div>
                </td>
                <td class="text-right">
                  {{ c.learners }}
                  <div class="text-caption text-muted">{{ c.completed }} completed</div>
                </td>
                <td class="text-no-wrap">
                  <span v-if="!c.rating.count" class="text-muted">No reviews</span>
                  <template v-else>
                    <span class="d-inline-flex align-center ga-2"><StarRating :value="c.rating.average" :size="14" />{{ fmtAvg(c.rating.average) }}</span>
                    <div class="text-caption text-muted">{{ plural(c.rating.count, 'review') }}</div>
                  </template>
                </td>
                <td class="text-right text-no-wrap">
                  <span v-if="!c.earned.length" class="text-muted">–</span>
                  <div v-for="e in c.earned" :key="e.currency">{{ money(e.amountMinor, e.currency) }}</div>
                </td>
                <td class="text-no-wrap text-muted">{{ date(c.assignedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-caption text-muted ma-0">To assign a course or change a share, open the course and use its Instructors tab.</p>
      </section>

      <section class="d-flex flex-column ga-3" aria-labelledby="h-recent">
        <h2 id="h-recent" class="ptitle">Latest earnings</h2>
        <div v-if="!data.recent.length" class="panel pa-8 text-center text-body-2 text-muted">No sales of their courses yet.</div>
        <div v-else class="table-scroll">
          <table class="data-table" style="min-width: 640px">
            <caption class="sr-only">Latest earnings</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Course</th>
                <th scope="col" class="text-right">Sale</th>
                <th scope="col" class="text-right">Share</th>
                <th scope="col" class="text-right">Earned</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in data.recent" :key="e.id">
                <td class="text-no-wrap text-muted">{{ date(e.createdAt) }}</td>
                <td>{{ e.courseTitle }}</td>
                <td class="text-right text-no-wrap">{{ money(e.baseMinor, e.currency) }}</td>
                <td class="text-right">{{ percentBp(e.percentBp) }}</td>
                <td class="text-right text-no-wrap font-weight-medium">{{ money(e.amountMinor, e.currency) }}</td>
                <td><StatusPill :label="e.status === 'PAID' ? 'Paid' : 'Unpaid'" :tone="e.status === 'PAID' ? 'success' : 'warning'" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.avatar {
  width: 56px;
  height: 56px;
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
  font-size: 18px;
  font-weight: 700;
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 40px;
  margin: 0;
}
.facts dt {
  font-size: 12px;
  color: var(--ot-muted);
}
.facts dd {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.stat-value.sm {
  font-size: 22px;
}
.ptitle {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.thumb {
  width: 64px;
  height: 40px;
  flex: none;
  border-radius: 6px;
  object-fit: cover;
}
@media (max-width: 900px) {
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
