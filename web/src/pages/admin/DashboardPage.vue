<script setup lang="ts">
// Admin dashboard (mockup): stat tiles, "Needs attention" callouts, recent orders and the grading queue.
import { onMounted, ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import * as api from '@/api/admin/dashboard';
import * as gradingApi from '@/api/admin/grading';
import { dateTime, methodLabel, money } from '@/utils/format';

const d = ref<api.Dashboard | null>(null);
const grading = ref<gradingApi.GradingRow[]>([]);
onMounted(async () => {
  const [dash, q] = await Promise.all([api.dashboard(), gradingApi.queue().catch(() => [])]);
  d.value = dash;
  grading.value = q.slice(0, 5);
});
</script>

<template>
  <div class="admin-page">
    <AdminPageHeader title="Dashboard" subtitle="What needs your attention today." />
    <v-skeleton-loader v-if="!d" type="card@2" color="surface" />
    <div v-else class="d-flex flex-column ga-6">
      <div class="tiles">
        <router-link to="/admin/courses" class="stat panel">
          <span class="stat-label">Published courses</span>
          <span class="stat-value">{{ d.publishedCourses }}</span>
          <span class="stat-note">{{ d.draftCourses }} {{ d.draftCourses === 1 ? 'draft' : 'drafts' }}</span>
        </router-link>
        <router-link to="/admin/users" class="stat panel">
          <span class="stat-label">Learners</span>
          <span class="stat-value">{{ d.learners }}</span>
          <span class="stat-note">{{ d.enrollments }} enrolments</span>
        </router-link>
        <router-link v-for="s in d.salesThisMonth" :key="s.currency" to="/admin/revenue" class="stat panel">
          <span class="stat-label">Sales this month · {{ s.currency.toUpperCase() }}</span>
          <span class="stat-value">{{ money(s.amountMinor, s.currency) }}</span>
          <span class="stat-note">{{ s.orders }} {{ s.orders === 1 ? 'order' : 'orders' }}</span>
        </router-link>
        <div v-if="!d.salesThisMonth.length" class="stat panel">
          <span class="stat-label">Sales this month</span>
          <span class="stat-value">0</span>
          <span class="stat-note">No orders yet</span>
        </div>
        <router-link to="/admin/grading" class="stat panel">
          <span class="stat-label">Waiting for grading</span>
          <span class="stat-value">{{ d.gradingWaiting }}</span>
          <span class="stat-note" :style="d.gradingWaiting ? 'color: var(--ot-warning)' : ''">{{ d.gradingWaiting ? 'Written answers to check' : 'All caught up' }}</span>
        </router-link>
      </div>

      <section class="panel pa-5 d-flex flex-column ga-4" aria-labelledby="na-h">
        <h2 id="na-h" class="h2">Needs attention</h2>
        <div class="attn">
          <router-link to="/admin/grading" class="callout" :class="{ warning: d.gradingWaiting }"><span class="flex-grow-1">Essays to grade</span><strong>{{ d.gradingWaiting }}</strong></router-link>
          <router-link to="/admin/payments/review" class="callout" :class="{ warning: d.slipsWaiting }"><span class="flex-grow-1">Bank slips to review</span><strong>{{ d.slipsWaiting }}</strong></router-link>
          <router-link to="/admin/support" class="callout"><span class="flex-grow-1">Open support conversations</span><strong>{{ d.openSupport }}</strong></router-link>
        </div>
      </section>

      <div class="two">
        <section class="panel" aria-labelledby="ro-h">
          <div class="panel-head"><h2 id="ro-h" class="h2">Recent orders</h2><router-link to="/admin/revenue" class="text-body-2 link">View all</router-link></div>
          <ul class="rows">
            <li v-for="o in d.recentOrders" :key="o.id">
              <span style="min-width: 0">
                <span class="d-block font-weight-medium">{{ o.course }}</span>
                <span class="d-block text-caption text-muted mt-1">{{ o.user.name }} · {{ dateTime(o.paidAt) }}<template v-if="o.method"> · {{ methodLabel[o.method] ?? o.method }}</template></span>
              </span>
              <span class="font-weight-bold text-no-wrap">{{ money(o.amountMinor, o.currency) }}</span>
            </li>
            <li v-if="!d.recentOrders.length" class="text-muted">No orders yet.</li>
          </ul>
        </section>
        <section class="panel" aria-labelledby="ng-h">
          <div class="panel-head"><h2 id="ng-h" class="h2">Needs grading</h2><router-link to="/admin/grading" class="text-body-2 link">Open queue</router-link></div>
          <ul class="rows">
            <li v-for="g in grading" :key="g.attemptId">
              <router-link :to="`/admin/grading/${g.attemptId}`" class="d-flex justify-space-between ga-3 w-100 text-decoration-none" style="color: inherit">
                <span style="min-width: 0">
                  <span class="d-block font-weight-medium">{{ g.learner.name }}</span>
                  <span class="d-block text-caption text-muted mt-1">{{ g.course.title }}</span>
                </span>
                <span class="text-caption text-muted text-no-wrap">{{ dateTime(g.submittedAt) }}</span>
              </router-link>
            </li>
            <li v-if="!grading.length" class="text-muted">Nothing to grade.</li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Even rows: 4 across on a wide screen, 2 x 2 on a tablet (auto-fit gave 3 + 1), 1 on a phone. */
.tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 1279px) {
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 520px) {
  .tiles {
    grid-template-columns: minmax(0, 1fr);
  }
}
.h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.attn {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}
.attn strong {
  font-size: 18px;
  color: var(--ot-accent-strong);
}
.attn .warning strong {
  color: var(--ot-warning);
}
.two {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-start;
}
.two > section {
  flex: 1 1 380px;
  min-width: 0;
  overflow: hidden;
}
.link {
  display: inline-flex;
  align-items: center;
  min-height: var(--ot-control-h);
  padding: 0 var(--ot-space-1);
  margin-right: calc(-1 * var(--ot-space-1));
  border-radius: var(--ot-radius-control);
  color: var(--ot-accent-strong);
  text-decoration: none;
  font-weight: 500;
}
.link:hover {
  background: var(--ot-accent-hover);
  text-decoration: underline;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
}
.rows li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--ot-border);
  font-size: 14px;
}
.rows li:last-child {
  border-bottom: 0;
}
</style>
