<script setup lang="ts">
// One instructor (2026-11-24): opened from a row on the Instructors page.
// Shows the account, the courses they are assigned to (share, co-instructor, learners, rating, earned)
// and their earnings. Assignments and shares are still changed in the course editor's Instructors tab.
// 2026-11-27: the sign-up application (profile and documents) with Approve / Not approve, and the instructor's
// revenue share: one percent of the sales of every course they own (co-instructors get nothing from the system).
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import StarRating from '@/components/review/StarRating.vue';
import * as api from '@/api/admin/instructors';
import { errorMessage } from '@/api/client';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import { date, initials, money, percentBp, plural, priceLabel } from '@/utils/format';

const route = useRoute();
const data = ref<api.InstructorDetail | null>(null);
const err = ref('');

async function load(quiet = false) {
  err.value = '';
  if (!quiet) data.value = null;
  try {
    data.value = await api.getInstructor(String(route.params.id));
  } catch (e) {
    err.value = errorMessage(e);
  }
}
watch(() => route.params.id, () => load(), { immediate: true });

const profile = computed(() => data.value?.profile ?? null);
const busy = ref(false);
const actErr = ref('');
const approving = ref(false);
const rejecting = ref(false);
const reason = ref('');
const share = ref('');
const shareSaved = ref(false);
watch(profile, (p) => (share.value = p ? String(p.sharePercentBp / 100) : ''), { immediate: true });
async function act(fn: () => Promise<unknown>) {
  busy.value = true;
  actErr.value = '';
  try {
    await fn();
    approving.value = rejecting.value = false;
    reason.value = '';
    await load(true);
  } catch (e) {
    actErr.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
const approve = () => act(() => api.approve(String(route.params.id)));
const reject = () => act(() => api.reject(String(route.params.id), reason.value.trim()));
async function saveShare() {
  shareSaved.value = false;
  const v = share.value.trim();
  const n = Number(v);
  if (!/^\d+(\.\d{1,2})?$/.test(v) || n < 0 || n > 100) return void (actErr.value = 'Enter a share from 0 to 100%.');
  await act(() => api.setRevenueShare(String(route.params.id), Math.round(n * 100)));
  if (!actErr.value) shareSaved.value = true;
}
const mb = (b?: number) => (!b ? '' : b < 100 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

const courseTone = (s: string) => (s === 'PUBLISHED' ? 'success' : s === 'DRAFT' || s === 'IN_REVIEW' ? 'warning' : 'neutral');
const COURSE_LABEL: Record<string, string> = { DRAFT: 'Draft', IN_REVIEW: 'In review', PUBLISHED: 'Published', ARCHIVED: 'Archived' };
const courseLabel = (s: string) => COURSE_LABEL[s] ?? s;
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
          <div v-if="profile?.phone"><dt>Phone</dt><dd>{{ profile.phone }}</dd></div>
        </dl>
      </div>
      <div v-if="actErr" class="callout danger" role="alert">{{ actErr }}</div>

      <section v-if="profile" class="panel pa-6 d-flex flex-column ga-4" aria-labelledby="h-app">
        <div class="d-flex flex-wrap align-center justify-space-between ga-3">
          <div class="d-flex flex-wrap align-center ga-3">
            <h2 id="h-app" class="ptitle">{{ profile.status === 'APPROVED' ? 'Profile' : 'Application' }}</h2>
            <StatusPill
              :label="profile.status === 'APPROVED' ? 'Approved' : profile.status === 'REJECTED' ? 'Not approved' : 'Waiting for approval'"
              :tone="profile.status === 'APPROVED' ? 'success' : profile.status === 'REJECTED' ? 'danger' : 'warning'"
            />
            <span v-if="profile.submittedAt" class="text-caption text-muted">Sent {{ date(profile.submittedAt) }}</span>
          </div>
          <span v-if="profile.status !== 'APPROVED'" class="d-flex flex-wrap ga-2">
            <v-btn v-if="profile.status === 'PENDING'" variant="outlined" :disabled="busy" @click="rejecting = true">Not approve</v-btn>
            <v-btn color="primary" :loading="busy" @click="approving = true">Approve</v-btn>
          </span>
        </div>
        <div v-if="profile.status === 'REJECTED' && profile.rejectReason" class="callout warning"><span><strong>Reason given:</strong> {{ profile.rejectReason }}</span></div>
        <div>
          <div class="font-weight-bold">{{ profile.headline || 'No headline' }}</div>
          <p class="ma-0 mt-2 text-body-2 bio">{{ profile.bio || 'No description.' }}</p>
          <div v-if="profile.expertise.length" class="d-flex flex-wrap ga-2 mt-3">
            <v-chip v-for="t in profile.expertise" :key="t" size="small">{{ t }}</v-chip>
          </div>
        </div>
        <div>
          <h3 class="sub">Documents</h3>
          <ul class="docs">
            <li v-for="d in profile.documents" :key="d.id">
              <v-icon :icon="d.mime === 'application/pdf' ? 'mdi-file-pdf-box' : 'mdi-file-image-outline'" size="22" class="text-muted" />
              <a :href="d.url" target="_blank" rel="noopener" class="flex-grow-1 font-weight-medium text-truncate">{{ d.title }}</a>
              <span class="text-caption text-muted">{{ d.isPublic ? 'Shown on profile' : 'Admins only' }}</span>
              <span class="text-caption text-muted">{{ mb(d.sizeBytes) }}</span>
            </li>
            <li v-if="!profile.documents.length" class="text-body-2 text-muted">No documents.</li>
          </ul>
          <p class="text-caption text-muted mt-2 mb-0">Links work for 10 minutes. Reload the page for new ones.</p>
        </div>
      </section>

      <section v-if="profile?.status === 'APPROVED'" id="share" class="panel pa-6 d-flex flex-column ga-3" aria-labelledby="h-share">
        <h2 id="h-share" class="ptitle">Revenue share</h2>
        <p class="ma-0 text-body-2 text-muted">
          The instructor gets this percent of the sales of <strong>every course they own</strong>. Co-investors get their percent of what is left.
          A change applies to orders paid after it. Co-instructors on their courses get nothing from the system; the owner shares with them.
        </p>
        <form class="d-flex flex-wrap align-center ga-3" @submit.prevent="saveShare">
          <label for="share-in" class="text-body-2">Share</label>
          <span class="d-inline-flex align-center ga-1">
            <input id="share-in" v-model="share" class="ot-input" style="width: 96px; text-align: right" inputmode="decimal" />
            <span aria-hidden="true">%</span>
          </span>
          <v-btn type="submit" color="primary" :loading="busy" :disabled="share === String(profile.sharePercentBp / 100)">Save</v-btn>
          <span v-if="shareSaved" class="text-caption text-success" role="status">Saved</span>
        </form>
      </section>

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
        <h2 id="h-courses" class="ptitle">Courses</h2>
        <div v-if="!data.courses.length" class="panel pa-8 text-center text-body-2 text-muted">
          No courses yet. Instructors make their own courses once approved.
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
                      <router-link :to="c.owner ? `/admin/courses/${c.id}/preview` : `/admin/courses/${c.id}`" class="font-weight-medium">{{ c.title }}</router-link>
                      <div class="d-flex align-center ga-2 mt-1">
                        <StatusPill :label="courseLabel(c.status)" :tone="courseTone(c.status)" />
                        <span class="text-caption text-muted">{{ priceLabel(c) }}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="text-no-wrap font-weight-medium">
                  <template v-if="c.owner">{{ c.owner.id === data.id ? `Owner · ${percentBp(profile?.sharePercentBp ?? 0)}` : 'Co-instructor · none' }}</template>
                  <template v-else>{{ c.sharePercentBp ? percentBp(c.sharePercentBp) : 'No share' }}</template>
                </td>
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
        <p class="text-caption text-muted ma-0">Courses they own pay the revenue share above. Older admin-made courses keep the share set in that course's Instructors tab.</p>
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
    <ConfirmDialog v-model="approving" title="Approve this instructor?" confirm-label="Approve" :loading="busy" @confirm="approve">
      <strong>{{ data?.name }}</strong> can make courses and gets a public profile. Set their revenue share next.
    </ConfirmDialog>
    <v-dialog v-model="rejecting" max-width="520">
      <v-card color="surface" class="pa-2">
        <v-card-title>Not approve this application</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-muted mt-0">The applicant sees your reason and can update their details or documents and send it again.</p>
          <v-textarea v-model="reason" label="Reason" rows="3" auto-grow maxlength="1000" counter autofocus />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="rejecting = false">Cancel</v-btn>
          <v-btn color="primary" :loading="busy" :disabled="!reason.trim()" @click="reject">Not approve</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.sub {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}
.bio {
  white-space: pre-line;
  line-height: 1.6;
}
.docs {
  list-style: none;
  margin: 0;
  padding: 0;
}
.docs li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--ot-border);
}
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
