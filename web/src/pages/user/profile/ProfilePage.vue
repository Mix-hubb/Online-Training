<script setup lang="ts">
// Profile: My learning (statuses from 15.3), certificates, notifications, account.
import { computed, onMounted, ref } from 'vue';
import EmptyState from '@/components/common/EmptyState.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import * as certApi from '@/api/certificates';
import * as learningApi from '@/api/learning';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';
import type { LearningStatus, MyCourse } from '@/types';
import { date, dateTime, initials, learningStatusLabel } from '@/utils/format';

const auth = useAuthStore();
const notes = useNotificationsStore();
const courses = ref<MyCourse[] | null>(null);
const certs = ref<Awaited<ReturnType<typeof certApi.mine>> | null>(null);
const filter = ref<'all' | 'active' | 'done'>('all');
const tabs = [
  { v: 'all' as const, label: 'All' },
  { v: 'active' as const, label: 'In progress' },
  { v: 'done' as const, label: 'Completed' },
];

onMounted(async () => {
  void notes.refresh();
  [courses.value, certs.value] = await Promise.all([learningApi.myCourses().catch(() => []), certApi.mine().catch(() => [])]);
});
const shown = computed(() => (courses.value ?? []).filter((c) => (filter.value === 'all' ? true : filter.value === 'done' ? c.status === 'COMPLETED' : c.status !== 'COMPLETED')));
const tone = (s: LearningStatus) => (s === 'COMPLETED' ? 'success' : s === 'WAITING_FOR_INSTRUCTOR' || s === 'LESSONS_RESTARTED' ? 'warning' : s === 'READY_FOR_TEST' ? 'info' : 'neutral');
function target(c: MyCourse) {
  if (c.status === 'READY_FOR_TEST') return `/learn/${c.course.slug}/quiz`;
  if (c.status === 'WAITING_FOR_INSTRUCTOR' || c.status === 'COMPLETED') return `/learn/${c.course.slug}/result`;
  return `/learn/${c.course.slug}${c.lastLesson ? `?lesson=${c.lastLesson.id}` : ''}`;
}
const action: Record<LearningStatus, string> = {
  IN_PROGRESS: 'Continue',
  READY_FOR_TEST: 'Take the test',
  WAITING_FOR_INSTRUCTOR: 'View status',
  LESSONS_RESTARTED: 'Restart lessons',
  COMPLETED: 'View result',
};
</script>

<template>
  <div class="page profile">
    <aside class="side" aria-label="Profile">
      <section class="panel pa-5 d-flex flex-column ga-4">
        <div class="d-flex align-center ga-3">
          <v-avatar size="52" color="primary-tint">
            <v-img v-if="auth.user?.avatarUrl" :src="auth.user.avatarUrl" :alt="auth.user.name" />
            <span v-else class="font-weight-bold" style="color: var(--ot-accent-tint-text)">{{ initials(auth.user?.name ?? '') }}</span>
          </v-avatar>
          <div style="min-width: 0">
            <div class="font-weight-bold text-body-1">{{ auth.user?.name }}</div>
            <div class="text-body-2 text-muted text-truncate">{{ auth.user?.email }}</div>
          </div>
        </div>
        <span class="pill success align-self-start">{{ auth.user?.hasPassword ? 'Email verified' : 'Google account' }}</span>
        <div class="d-flex flex-column ga-2">
          <v-btn v-if="auth.user?.hasPassword" variant="outlined" block to="/account/change-password">Change password</v-btn>
          <v-btn variant="outlined" block to="/profile/orders">Orders and receipts</v-btn>
        </div>
      </section>

      <section class="panel" aria-labelledby="notif-h">
        <div class="panel-head">
          <h2 id="notif-h" class="h2">Notifications</h2>
          <span v-if="notes.unread" class="pill">{{ notes.unread }} new</span>
        </div>
        <div v-if="!notes.items.length" class="pa-5 text-body-2 text-muted">No notifications yet.</div>
        <component
          :is="n.link ? 'router-link' : 'div'"
          v-for="n in notes.items.slice(0, 8)"
          :key="n.id"
          :to="n.link ?? undefined"
          class="note"
          :class="{ unread: !n.readAt }"
          @click="notes.markRead(n.id)"
        >
          <span class="text-body-2">{{ n.text }}</span>
          <span class="text-caption text-muted">{{ dateTime(n.createdAt) }}</span>
        </component>
        <div v-if="notes.unread" class="pa-3"><v-btn size="small" variant="text" color="primary" @click="notes.markAll()">Mark all read</v-btn></div>
      </section>
    </aside>

    <div class="main-col">
      <section aria-labelledby="learn-h" class="d-flex flex-column ga-4">
        <div class="d-flex flex-wrap align-center justify-space-between ga-3">
          <h1 id="learn-h" class="page-title mb-0">My learning</h1>
          <div role="tablist" aria-label="Filter courses" class="seg">
            <button v-for="t in tabs" :key="t.v" type="button" role="tab" :aria-selected="filter === t.v" :class="{ on: filter === t.v }" @click="filter = t.v">{{ t.label }}</button>
          </div>
        </div>
        <v-skeleton-loader v-if="!courses" type="list-item-avatar-two-line@3" color="surface" />
        <EmptyState v-else-if="!shown.length" class="panel" icon="mdi-school-outline" title="No courses here yet" text="Courses you enrol in appear here." action-label="Browse courses" action-to="/" />
        <article v-for="c in shown" :key="c.enrollmentId" class="row panel">
          <span class="thumb"><img v-if="c.course.thumbnailUrl" :src="c.course.thumbnailUrl" alt="" /></span>
          <div class="flex-grow-1 d-flex flex-column ga-2" style="min-width: 0">
            <router-link :to="`/courses/${c.course.slug}`" class="title">{{ c.course.title }}</router-link>
            <div class="d-flex flex-wrap align-center ga-2">
              <StatusPill :label="learningStatusLabel[c.status]" :tone="tone(c.status)" />
              <span v-if="c.cycle > 1" class="pill neutral">Round {{ c.cycle }}</span>
              <span class="text-body-2 text-muted">{{ c.completedLessons }} of {{ c.totalLessons }} lessons · Last activity {{ date(c.lastActivity) }}</span>
            </div>
            <div class="d-flex align-center ga-2" style="max-width: 420px">
              <span class="bar" role="progressbar" aria-label="Lesson progress" :aria-valuenow="c.percent" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${c.percent}%` }" /></span>
              <span class="text-caption text-muted">{{ c.percent }}%</span>
            </div>
          </div>
          <div class="d-flex flex-wrap ga-2">
            <v-btn v-if="c.certificate" variant="outlined" :to="`/certificates/${c.certificate.number}`">Certificate</v-btn>
            <v-btn color="primary" :to="target(c)">{{ action[c.status] }}</v-btn>
          </div>
        </article>
      </section>

      <section aria-labelledby="cert-h" class="d-flex flex-column ga-4">
        <h2 id="cert-h" class="section-title my-0">Certificates</h2>
        <div v-if="certs && !certs.length" class="panel pa-5 text-body-2 text-muted">No certificates yet. Pass a course's final test to earn one.</div>
        <div class="certs">
          <div v-for="c in certs ?? []" :key="c.id" class="panel pa-5 d-flex flex-column ga-2">
            <div class="text-caption text-muted mono">{{ c.number }}</div>
            <div class="font-weight-bold">{{ c.course.title }}</div>
            <div class="text-caption text-muted">Issued {{ date(c.issuedAt) }}</div>
            <div class="d-flex flex-wrap ga-2 mt-2">
              <v-btn size="small" color="primary" prepend-icon="mdi-download" @click="certApi.downloadPdf(c.id, c.number)">PDF</v-btn>
              <v-btn size="small" variant="outlined" :to="`/certificates/${c.number}`">Public link</v-btn>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  align-items: flex-start;
}
.side {
  flex: 1 1 300px;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.main-col {
  flex: 999 1 560px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.note {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--ot-border);
  text-decoration: none;
  color: var(--ot-text-2);
  cursor: pointer;
}
.note.unread {
  border-left: 3px solid var(--ot-accent);
  padding-left: 17px;
  background: var(--ot-info-bg);
  color: var(--ot-text);
}
.seg {
  display: inline-flex;
  border: 1px solid var(--ot-input-border);
  border-radius: var(--ot-radius-control);
  background: var(--ot-surface);
  overflow: hidden;
  box-shadow: var(--ot-shadow-btn);
}
.seg button {
  min-height: 40px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--ot-muted);
  border: 0;
  background: transparent;
  cursor: pointer;
}
.seg button + button {
  border-left: 1px solid var(--ot-input-border);
}
.seg button.on {
  background: var(--ot-accent-tint);
  color: var(--ot-accent-strong);
  font-weight: 600;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  padding: 18px;
}
.thumb {
  flex: none;
  width: 128px;
  height: 72px;
  border-radius: 4px;
  background: var(--ot-thumb);
  overflow: hidden;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ot-text);
  text-decoration: none;
}
.bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--ot-border);
  overflow: hidden;
}
.bar > span {
  display: block;
  height: 6px;
  background: var(--ot-accent);
}
.certs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
@media (max-width: 960px) {
  .side {
    max-width: none;
  }
}
</style>
