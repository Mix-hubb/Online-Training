<script setup lang="ts">
// Two-column chat used by the learner (/messages), instructor (/instructor/messages) and admin (/admin/support).
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import ThreadList from './ThreadList.vue';
import MessageList from './MessageList.vue';
import MessageComposer from './MessageComposer.vue';
import * as chatApi from '@/api/chat';
import { errorMessage } from '@/api/client';
import type { ThreadDetail, ThreadSummary } from '@/types';

const props = defineProps<{ basePath: string; loadThreads: () => Promise<ThreadSummary[]>; staff?: boolean; title: string }>();
defineSlots<{ actions?: () => unknown; filters?: () => unknown }>();
const route = useRoute();
const router = useRouter();
const { mdAndUp } = useDisplay();
const threads = ref<ThreadSummary[]>([]);
const detail = ref<ThreadDetail | null>(null);
const sending = ref(false);
const err = ref('');
const composer = ref<InstanceType<typeof MessageComposer> | null>(null);
const selectedId = computed(() => (route.params.threadId ? String(route.params.threadId) : null));

async function refreshThreads() {
  threads.value = await props.loadThreads().catch(() => threads.value);
}
async function openThread(id: string | null) {
  detail.value = null;
  err.value = '';
  if (!id) return;
  try {
    detail.value = await chatApi.messages(id);
    void refreshThreads();
  } catch (e) {
    err.value = errorMessage(e);
  }
}
watch(selectedId, openThread);
let poll: ReturnType<typeof setInterval> | undefined;
onMounted(async () => {
  await refreshThreads();
  await openThread(selectedId.value);
  poll = setInterval(async () => {
    await refreshThreads();
    if (selectedId.value && detail.value) {
      const d = await chatApi.messages(selectedId.value).catch(() => null);
      if (d && d.messages.length !== detail.value.messages.length) detail.value = d;
    }
  }, 15_000);
});
onBeforeUnmount(() => clearInterval(poll));

async function send(m: chatApi.MessageInput) {
  if (!detail.value) return;
  sending.value = true;
  err.value = '';
  try {
    await chatApi.send(detail.value.thread.id, m);
    composer.value?.reset();
    detail.value = await chatApi.messages(detail.value.thread.id);
    void refreshThreads();
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    sending.value = false;
  }
}
async function closeThread() {
  if (!detail.value) return;
  await chatApi.close(detail.value.thread.id);
  await openThread(detail.value.thread.id);
}
function select(id: string) {
  void router.push(`${props.basePath}/${id}`);
}
defineExpose({ refreshThreads, select });
</script>

<template>
  <div class="chat panel">
    <section v-if="mdAndUp || !selectedId" class="threads" aria-label="Conversations">
      <div class="thead">
        <div class="d-flex align-center justify-space-between ga-2">
          <h2 class="h2">{{ title }}</h2>
          <slot name="actions" />
        </div>
        <slot name="filters" />
      </div>
      <div class="flex-grow-1 overflow-y-auto"><ThreadList :threads="threads" :selected-id="selectedId" :staff="staff" @select="select" /></div>
    </section>
    <section v-if="mdAndUp || selectedId" class="conv" aria-label="Conversation">
      <template v-if="detail">
        <div class="chead">
          <v-btn v-if="!mdAndUp" icon="mdi-arrow-left" variant="text" size="small" aria-label="Back to conversations" :to="basePath" />
          <div class="d-flex flex-column ga-1 flex-grow-1" style="min-width: 0">
            <h2 class="h2 ctitle text-truncate">{{ detail.thread.subject }}</h2>
            <span class="text-body-2 text-muted text-truncate">
              <template v-if="detail.thread.learner">{{ detail.thread.learner.name }} · </template>{{ detail.thread.type === 'SUPPORT' ? 'Support' : detail.thread.course?.title }}
            </span>
          </div>
          <div class="d-flex align-center ga-2">
            <span class="pill" :class="detail.thread.status === 'CLOSED' ? 'neutral' : ''">{{ detail.thread.status === 'CLOSED' ? 'Closed' : 'Open' }}</span>
            <v-btn v-if="staff && detail.thread.status !== 'CLOSED'" size="small" variant="outlined" @click="closeThread">Close</v-btn>
          </div>
        </div>
        <div v-if="err" class="callout danger ma-3" role="alert">{{ err }}</div>
        <MessageList :messages="detail.messages" />
        <div v-if="detail.thread.status === 'CLOSED'" class="text-caption text-muted px-5 pt-2">This conversation is closed. Sending a message opens it again.</div>
        <MessageComposer ref="composer" :loading="sending" @send="send" />
      </template>
      <div v-else-if="err" class="pa-8 text-center text-body-2 text-muted">{{ err }}</div>
      <div v-else-if="selectedId" class="pa-8 text-center"><v-progress-circular indeterminate color="primary" /></div>
      <div v-else class="pa-8 text-center text-body-2 text-muted flex-grow-1 d-flex flex-column align-center justify-center ga-2">
        <v-icon icon="mdi-forum-outline" size="36" color="primary" />
        Choose a conversation.
      </div>
    </section>
  </div>
</template>

<style scoped>
.chat {
  display: flex;
  height: calc(100vh - 200px);
  min-height: 560px;
  overflow: hidden;
}
.threads {
  width: 340px;
  flex-shrink: 0;
  border-right: 1px solid var(--ot-border);
  display: flex;
  flex-direction: column;
}
.thead {
  padding: 16px;
  border-bottom: 1px solid var(--ot-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.ctitle {
  font-size: 17px;
}
.conv {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.chead {
  padding: 16px 20px;
  border-bottom: 1px solid var(--ot-border);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
@media (max-width: 959px) {
  .threads {
    width: 100%;
    border-right: 0;
  }
}
</style>
