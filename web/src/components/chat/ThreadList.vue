<script setup lang="ts">
// Thread list (left column). Staff view shows the learner's name.
import type { ThreadSummary } from '@/types';
import { dateTime } from '@/utils/format';

defineProps<{ threads: ThreadSummary[]; selectedId: string | null; staff?: boolean }>();
defineEmits<{ select: [string] }>();
</script>

<template>
  <ul class="tlist">
    <li v-if="!threads.length" class="pa-6 text-center text-body-2 text-muted">No conversations.</li>
    <li v-for="t in threads" :key="t.id">
      <button type="button" class="trow" :class="{ on: t.id === selectedId }" :aria-current="t.id === selectedId ? 'true' : undefined" @click="$emit('select', t.id)">
        <span class="d-flex align-center justify-space-between ga-2">
          <span class="subject" :class="{ unread: t.unread }">{{ t.subject }}</span>
          <span class="time">{{ dateTime(t.lastMessageAt) }}</span>
        </span>
        <span class="preview">{{ t.lastMessage?.body || 'Image' }}</span>
        <span class="d-flex align-center flex-wrap ga-2">
          <span class="pill" :class="t.type === 'SUPPORT' ? 'warning' : ''" style="font-size: 11px">{{ t.type === 'SUPPORT' ? 'Support' : 'Course question' }}</span>
          <span v-if="t.status === 'CLOSED'" class="pill neutral" style="font-size: 11px">Closed</span>
          <span class="text-caption text-muted text-truncate" style="min-width: 0">{{ staff && t.learner ? t.learner.name : t.type === 'SUPPORT' ? 'Support team' : t.course?.title }}</span>
          <span v-if="t.unread" class="dot" :aria-label="`${t.unread} unread`" />
        </span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.tlist {
  list-style: none;
  margin: 0;
  padding: 0;
}
.trow {
  width: 100%;
  text-align: left;
  cursor: pointer;
  padding: 14px 16px 14px 13px;
  border: 0;
  border-bottom: 1px solid var(--ot-border);
  border-left: 3px solid transparent;
  background: transparent;
  color: var(--ot-text);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.trow:hover {
  background: var(--ot-raised);
}
.trow.on {
  border-left-color: var(--ot-accent);
  background: var(--ot-info-bg);
}
.trow:focus-visible {
  outline: 2px solid var(--ot-accent);
  outline-offset: -2px;
}
.subject {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
}
.subject.unread {
  font-weight: 700;
}
.time {
  font-size: 11px;
  color: var(--ot-muted);
  white-space: nowrap;
}
.preview {
  font-size: 13px;
  color: var(--ot-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: var(--ot-radius-control);
  background: var(--ot-accent);
  margin-left: auto;
  flex: none;
}
</style>
