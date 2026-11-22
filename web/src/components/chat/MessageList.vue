<script setup lang="ts">
// Message bubbles. Own messages on the right.
import { nextTick, ref, watch } from 'vue';
import AttachmentViewer from './AttachmentViewer.vue';
import type { ChatMessage } from '@/types';
import { dateTime } from '@/utils/format';

const props = defineProps<{ messages: ChatMessage[] }>();
const box = ref<HTMLDivElement | null>(null);
watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    box.value?.scrollTo({ top: box.value.scrollHeight });
  },
  { immediate: true },
);
const roleLabel: Record<string, string> = { ADMIN: 'Support', INSTRUCTOR: 'Instructor' };
</script>

<template>
  <div ref="box" class="list" aria-live="polite">
    <div class="privacy">Only you and our team can see this conversation.</div>
    <div v-if="!messages.length" class="text-center text-body-2 text-muted py-8">No messages yet.</div>
    <div v-for="m in messages" :key="m.id" class="msg" :class="{ mine: m.mine }">
      <span class="meta">
        {{ m.mine ? 'You' : m.sender?.name }}<template v-if="!m.mine && m.sender && roleLabel[m.sender.role]"> ({{ roleLabel[m.sender.role] }})</template> · {{ dateTime(m.createdAt) }}
      </span>
      <div class="bubble">
        <span v-if="m.body" style="white-space: pre-line; word-break: break-word">{{ m.body }}</span>
        <div v-if="m.attachments.length" class="d-flex flex-wrap ga-2">
          <AttachmentViewer v-for="a in m.attachments" :key="a.id" :attachment="a" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list {
  overflow-y: auto;
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.privacy {
  align-self: center;
  font-size: 12px;
  color: var(--ot-muted);
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-card);
  padding: 4px 12px;
}
.msg {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.msg.mine {
  align-items: flex-end;
}
.meta {
  font-size: 12px;
  color: var(--ot-muted);
}
.bubble {
  max-width: 74%;
  border-radius: var(--ot-radius-card);
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.55;
  background: var(--ot-raised);
  border: 1px solid var(--ot-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.msg.mine .bubble {
  background: var(--ot-info-bg);
  border-color: var(--ot-info-border);
}
</style>
