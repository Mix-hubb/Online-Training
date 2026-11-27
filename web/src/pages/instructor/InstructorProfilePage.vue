<script setup lang="ts">
// Instructor "My profile" / "My application" (2026-11-27). Pending: waiting for an admin. Rejected: the admin's
// reason; saving the profile sends the application again. Approved: the public profile details and which
// documents show on it (the rest are seen by admins only).
import { computed, onMounted, ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import StatusPill from '@/components/common/StatusPill.vue';
import ProfileFieldsForm from '@/components/instructor/ProfileFieldsForm.vue';
import * as api from '@/api/instructors';
import { errorMessage, fileToBase64 } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import type { InstructorProfile } from '@/types';

const auth = useAuthStore();
const p = ref<InstructorProfile | null>(null);
const form = ref<api.ProfileFields>({ phone: '', headline: '', bio: '', expertise: [] });
const busy = ref(false);
const saved = ref(false);
const err = ref('');
const input = ref<HTMLInputElement | null>(null);
const newDoc = ref<{ file: File; title: string; isPublic: boolean } | null>(null);
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

function set(v: InstructorProfile) {
  p.value = v;
  // Approved or rejected since this page was opened: reload the session so the menu and guards follow.
  if (auth.user?.role === 'INSTRUCTOR' && auth.user.instructorStatus !== v.status) void auth.refresh();
  form.value = { phone: v.phone ?? '', headline: v.headline ?? '', bio: v.bio ?? '', expertise: [...v.expertise] };
}
onMounted(async () => {
  try {
    set(await api.myProfile());
  } catch (e) {
    err.value = errorMessage(e);
  }
});
const statusLabel = computed(() => ({ PENDING: 'Waiting for review', APPROVED: 'Approved', REJECTED: 'Not approved' })[p.value?.status ?? 'PENDING']);
const tone = computed(() => (p.value?.status === 'APPROVED' ? 'success' : p.value?.status === 'REJECTED' ? 'danger' : 'warning'));

async function save(e: Event & { valid?: Promise<{ valid: boolean }> }) {
  if (e.valid && !(await e.valid).valid) return;
  err.value = '';
  saved.value = false;
  busy.value = true;
  try {
    const wasRejected = p.value?.status === 'REJECTED';
    set(await api.saveProfile({ ...form.value, phone: form.value.phone.trim(), headline: form.value.headline.trim(), bio: form.value.bio.trim() }));
    saved.value = true;
    if (wasRejected) await auth.refresh();
  } catch (e2) {
    err.value = errorMessage(e2);
  } finally {
    busy.value = false;
  }
}
function pick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!f) return;
  err.value = '';
  if (!ACCEPT.split(',').includes(f.type)) return void (err.value = 'Use a PDF, JPG, PNG or WebP file.');
  if (f.size > api.MAX_DOC_MB * 1024 * 1024) return void (err.value = `The file is larger than ${api.MAX_DOC_MB} MB.`);
  newDoc.value = { file: f, title: f.name.replace(/\.[^.]+$/, '').slice(0, 120), isPublic: false };
}
async function upload() {
  if (!newDoc.value?.title.trim()) return;
  err.value = '';
  busy.value = true;
  try {
    const d = newDoc.value;
    set(await api.addDocument({ title: d.title.trim(), isPublic: d.isPublic, file: { name: d.file.name, dataBase64: await fileToBase64(d.file) } }));
    newDoc.value = null;
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function togglePublic(id: string, isPublic: boolean) {
  err.value = '';
  try {
    set(await api.updateDocument(id, { isPublic }));
  } catch (e) {
    err.value = errorMessage(e);
  }
}
async function remove(id: string) {
  err.value = '';
  try {
    set(await api.removeDocument(id));
  } catch (e) {
    err.value = errorMessage(e);
  }
}
const mb = (b?: number) => (!b ? '' : b < 100 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
</script>

<template>
  <div class="admin-page d-flex flex-column ga-6" style="max-width: 860px">
    <AdminPageHeader
      :title="p?.status === 'APPROVED' ? 'My profile' : 'My application'"
      :subtitle="p?.status === 'APPROVED' ? 'What learners see on your public instructor profile.' : 'Your instructor application and documents.'"
    >
      <v-btn v-if="p?.status === 'APPROVED' && auth.user" variant="outlined" :to="`/instructors/${auth.user.id}`">View public profile</v-btn>
    </AdminPageHeader>
    <v-skeleton-loader v-if="!p && !err" type="article" color="surface" />
    <div v-if="err" class="callout danger" role="alert">{{ err }}</div>
    <template v-if="p">
      <section class="panel pa-6 d-flex flex-column ga-3" aria-labelledby="st-h">
        <div class="d-flex flex-wrap align-center ga-3">
          <h2 id="st-h" class="h3">Status</h2>
          <StatusPill :label="statusLabel" :tone="tone" />
        </div>
        <p v-if="p.status === 'PENDING'" class="ma-0 text-body-2">
          An admin is checking your documents. You will get a notification when it is done. Until then you can update your details and documents here.
        </p>
        <template v-else-if="p.status === 'REJECTED'">
          <div class="callout warning"><span><strong>Reason:</strong> {{ p.rejectReason || 'No reason given.' }}</span></div>
          <p class="ma-0 text-body-2">Update your details or documents, then press <strong>Save and send again</strong>.</p>
        </template>
        <p v-else class="ma-0 text-body-2">
          You can make courses from <router-link to="/instructor">My courses</router-link>. Your revenue share:
          <strong>{{ (p.sharePercentBp / 100).toLocaleString() }}%</strong> of the sales of the courses you own (set by an admin).
        </p>
      </section>

      <section class="panel pa-6 d-flex flex-column ga-4" aria-labelledby="pf-h">
        <h2 id="pf-h" class="h3">Profile</h2>
        <v-form class="d-flex flex-column ga-1" @submit.prevent="save">
          <ProfileFieldsForm v-model="form" />
          <div class="d-flex align-center ga-3 mt-2">
            <v-btn type="submit" color="primary" :loading="busy">{{ p.status === 'REJECTED' ? 'Save and send again' : 'Save' }}</v-btn>
            <span v-if="saved" class="text-caption text-success" role="status">Saved</span>
          </div>
        </v-form>
      </section>

      <section class="panel pa-6 d-flex flex-column ga-4" aria-labelledby="dc-h">
        <div>
          <h2 id="dc-h" class="h3">Documents</h2>
          <p class="ma-0 mt-1 text-body-2 text-muted">Admins see all of them. Tick <strong>Show on profile</strong> for the ones learners may see.</p>
        </div>
        <ul class="docs">
          <li v-for="d in p.documents" :key="d.id">
            <v-icon :icon="d.mime === 'application/pdf' ? 'mdi-file-pdf-box' : 'mdi-file-image-outline'" size="24" class="text-muted" />
            <span class="flex-grow-1" style="min-width: 0">
              <a :href="d.url" target="_blank" rel="noopener" class="d-block font-weight-bold text-truncate doc-link">{{ d.title }}</a>
              <span class="text-caption text-muted">{{ mb(d.sizeBytes) }}</span>
            </span>
            <label class="pub">
              <input type="checkbox" :checked="d.isPublic" @change="togglePublic(d.id, ($event.target as HTMLInputElement).checked)" />
              <span>Show on profile</span>
            </label>
            <button type="button" class="row-link danger" @click="remove(d.id)">Remove</button>
          </li>
          <li v-if="!p.documents.length" class="text-body-2 text-muted">No documents.</li>
        </ul>
        <div v-if="newDoc" class="d-flex flex-wrap align-center ga-3">
          <label for="nd-title" class="sr-only">Document name</label>
          <input id="nd-title" v-model="newDoc.title" class="ot-input" style="flex: 1 1 240px" maxlength="120" />
          <label class="pub"><input v-model="newDoc.isPublic" type="checkbox" /><span>Show on profile</span></label>
          <v-btn color="primary" :loading="busy" :disabled="!newDoc.title.trim()" @click="upload">Upload</v-btn>
          <v-btn variant="text" @click="newDoc = null">Cancel</v-btn>
        </div>
        <div v-else-if="p.documents.length < api.MAX_DOCS" class="d-flex flex-wrap align-center ga-3">
          <input ref="input" type="file" :accept="ACCEPT" class="sr-only" @change="pick" />
          <v-btn variant="outlined" prepend-icon="mdi-upload" @click="input?.click()">Add a document</v-btn>
          <span class="text-caption text-muted">PDF, JPG, PNG or WebP, up to {{ api.MAX_DOC_MB }} MB.</span>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.docs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.docs li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--ot-border);
}
.docs li:last-child {
  border-bottom: 1px solid var(--ot-border);
}
.doc-link {
  color: inherit;
  text-decoration: none;
}
.doc-link:hover {
  text-decoration: underline;
}
.pub {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  min-height: var(--ot-control-h);
  cursor: pointer;
}
</style>
