<script setup lang="ts">
import { ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import ChatWorkspace from '@/components/chat/ChatWorkspace.vue';
import * as chatApi from '@/api/chat';
const filter = ref({ type: '', status: 'OPEN' });
const types = [
  { v: '', t: 'All' },
  { v: 'SUPPORT', t: 'Support' },
  { v: 'COURSE', t: 'Course questions' },
];
const statuses = [
  { v: 'OPEN', t: 'Open' },
  { v: 'CLOSED', t: 'Closed' },
  { v: '', t: 'Any status' },
];
const load = () => chatApi.adminThreads({ type: filter.value.type || undefined, status: filter.value.status || undefined });
</script>
<template>
  <div class="admin-page">
    <AdminPageHeader title="Support inbox" subtitle="Learner questions to the support team and course instructors." />
    <ChatWorkspace :key="filter.type + filter.status" base-path="/admin/support" :load-threads="load" staff title="Conversations">
      <template #filters>
        <div class="d-flex flex-column ga-2">
          <div class="chipbar" role="group" aria-label="Type">
            <button v-for="o in types" :key="o.v" type="button" :aria-pressed="filter.type === o.v" @click="filter.type = o.v">{{ o.t }}</button>
          </div>
          <div class="chipbar" role="group" aria-label="Status">
            <button v-for="o in statuses" :key="o.v" type="button" :aria-pressed="filter.status === o.v" @click="filter.status = o.v">{{ o.t }}</button>
          </div>
        </div>
      </template>
    </ChatWorkspace>
  </div>
</template>
