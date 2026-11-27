<script setup lang="ts">
// Admin preview (mockup AdminPreview): a preview bar over the course page exactly as learners see it.
// Buying and enrolling are switched off here; drafts are served to admins by the catalog API.
// 2026-11-27: also the instructor's own preview (/instructor/courses/:id/preview), and where admins review
// instructor courses: Approve (publish) or Send back with a note the instructor sees in the editor.
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import { scope } from '@/api/admin/scope';
import CoursePage from '@/pages/user/course/CoursePage.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import * as api from '@/api/admin/courses';
import { errorMessage } from '@/api/client';

const route = useRoute();
const id = String(route.params.id);
const course = ref<api.AdminCourse | null>(null);
const err = ref('');
const base = scope();
const isAdmin = base === '/admin';
const exitTo = computed(() => (isAdmin && course.value?.ownerId ? '/admin/courses' : `${base}/courses/${id}`));
const rejecting = ref(false);
const note = ref('');
const approving = ref(false);
const busy = ref(false);
const done = ref('');
async function load() {
  try {
    course.value = await api.getOne(id);
  } catch (e) {
    err.value = errorMessage(e);
  }
}
onMounted(load);
async function review(fn: () => Promise<unknown>, msg: string) {
  busy.value = true;
  err.value = '';
  try {
    await fn();
    rejecting.value = approving.value = false;
    note.value = '';
    done.value = msg;
    await load();
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
const approve = () => review(() => api.approve(id), 'Approved. The course is now in the catalog.');
const sendBack = () => review(() => api.reject(id, note.value.trim()), 'Sent back to the instructor with your note.');
const tone = (s: string) => (s === 'PUBLISHED' ? 'success' : s === 'DRAFT' || s === 'IN_REVIEW' ? 'warning' : 'neutral');
const LABEL: Record<string, string> = { DRAFT: 'Draft', IN_REVIEW: 'Waiting for review', PUBLISHED: 'Published', ARCHIVED: 'Archived' };
const label = (s: string) => LABEL[s] ?? s;
</script>

<template>
  <div>
    <div class="pbar" role="status">
      <span><strong>Preview mode.</strong> You see this course the way a learner sees it. Nothing here is saved or counted, and buying is switched off.</span>
      <span class="d-flex align-center ga-3">
        <StatusPill v-if="course" :label="label(course.status)" :tone="tone(course.status)" />
        <router-link :to="exitTo" class="exit">Exit preview</router-link>
      </span>
    </div>
    <div v-if="isAdmin && course?.owner" class="rbar">
      <span class="text-body-2">
        By <strong>{{ course.owner.name }}</strong> ({{ course.owner.email }})
        <template v-if="course.submittedAt && course.status === 'IN_REVIEW'"> · sent for review {{ new Date(course.submittedAt).toLocaleString() }}</template>
        · {{ course.lessons.length }} {{ course.lessons.length === 1 ? 'lesson' : 'lessons' }}
        · final test {{ course.quiz?.questions.length ? `${course.quiz.questions.length} questions` : 'none' }}
      </span>
      <span v-if="course.status === 'IN_REVIEW'" class="d-flex flex-wrap ga-2">
        <v-btn variant="outlined" :disabled="busy" @click="rejecting = true">Send back</v-btn>
        <v-btn color="primary" :loading="busy" @click="approving = true">Approve and publish</v-btn>
      </span>
    </div>
    <div v-if="done" class="page pb-0"><div class="callout success" role="status">{{ done }}</div></div>
    <div v-if="err" class="page"><div class="callout danger" role="alert">{{ err }}</div></div>
    <v-skeleton-loader v-else-if="!course" type="heading, paragraph, image" color="surface" class="page" />
    <CoursePage v-else :slug="course.slug" preview />
    <ConfirmDialog v-model="approving" title="Approve this course?" confirm-label="Approve and publish" :loading="busy" @confirm="approve">
      <strong>{{ course?.title }}</strong> goes into the catalog now and learners can buy or enroll.
    </ConfirmDialog>
    <v-dialog v-model="rejecting" max-width="520">
      <v-card color="surface" class="pa-2">
        <v-card-title>Send back to the instructor</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-muted mt-0">The course goes back to draft. Tell the instructor what to change; they see this note in the editor.</p>
          <v-textarea v-model="note" label="What to change" rows="4" auto-grow maxlength="1000" counter autofocus />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="rejecting = false">Cancel</v-btn>
          <v-btn color="primary" :loading="busy" :disabled="!note.trim()" @click="sendBack">Send back</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.rbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 24px;
  background: var(--ot-surface);
  border-bottom: 1px solid var(--ot-border);
}
.pbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 24px;
  background: var(--ot-warning-bg);
  border-bottom: 1px solid var(--ot-warning-border);
  font-size: 14px;
  color: var(--ot-text);
}
.exit {
  min-height: var(--ot-control-h);
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  border-radius: var(--ot-radius-control);
  border: 1px solid var(--ot-input-border);
  background: var(--ot-surface);
  color: var(--ot-text);
  font-weight: 600;
  text-decoration: none;
  box-shadow: var(--ot-shadow-btn);
}
</style>
