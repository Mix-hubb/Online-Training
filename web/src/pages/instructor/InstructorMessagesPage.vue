<script setup lang="ts">
import { ref } from 'vue';
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue';
import ChatWorkspace from '@/components/chat/ChatWorkspace.vue';
import * as chatApi from '@/api/chat';
const status = ref('');
const load = () => chatApi.instructorThreads({ status: status.value || undefined });
</script>

<template>
  <div class="admin-page">
    <AdminPageHeader title="Messages" subtitle="Questions from learners in your courses." />
    <ChatWorkspace :key="status" base-path="/instructor/messages" :load-threads="load" staff title="Learner questions">
      <template #filters>
        <div class="chipbar" role="group" aria-label="Status">
          <button v-for="o in [{ v: '', t: 'All' }, { v: 'OPEN', t: 'Open' }, { v: 'CLOSED', t: 'Closed' }]" :key="o.v" type="button" :aria-pressed="status === o.v" @click="status = o.v">{{ o.t }}</button>
        </div>
      </template>
    </ChatWorkspace>
  </div>
</template>
