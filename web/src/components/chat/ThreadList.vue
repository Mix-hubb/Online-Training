<script setup lang="ts">
// Thread list (left column), inbox style (2026-11-25):
//   [avatar]  WHO (learner name for staff; "Support team" / course for the learner)   time
//             Subject
//             You: last message …                                                  unread
// Staff also see the type tag, since one learner can have support and course threads.
import type { ThreadSummary } from '@/types';
import { dateTime, initials, shortWhen } from '@/utils/format';

const props = defineProps<{ threads: ThreadSummary[]; selectedId: string | null; staff?: boolean }>();
defineEmits<{ select: [string] }>();

function who(t: ThreadSummary): string {
  if (props.staff && t.learner) return t.learner.name;
  return t.type === 'SUPPORT' ? 'Support team' : (t.course?.title ?? 'Course question');
}
function preview(t: ThreadSummary): string {
  const m = t.lastMessage;
  if (!m) return 'No messages yet';
  const text = m.body.trim() || 'Sent a photo';
  return m.mine ? `You: ${text}` : text;
}
</script>

<template>
  <ul class="tlist">
    <li v-if="!threads.length" class="pa-6 text-center text-body-2 text-muted">No conversations.</li>
    <li v-for="t in threads" :key="t.id">
      <button type="button" class="trow" :class="{ on: t.id === selectedId, unread: t.unread }" :aria-current="t.id === selectedId ? 'true' : undefined" @click="$emit('select', t.id)">
        <span class="av" :class="{ support: !staff && t.type === 'SUPPORT', course: !staff && t.type === 'COURSE' }" aria-hidden="true">
          <img v-if="staff && t.learner?.avatarUrl" :src="t.learner.avatarUrl" alt="" referrerpolicy="no-referrer" />
          <template v-else-if="staff && t.learner">{{ initials(t.learner.name) }}</template>
          <v-icon v-else :icon="t.type === 'SUPPORT' ? 'mdi-message-outline' : 'mdi-school-outline'" size="18" />
        </span>
        <span class="body">
          <span class="top">
            <span class="who">{{ who(t) }}</span>
            <time class="time" :datetime="t.lastMessageAt" :title="dateTime(t.lastMessageAt)">{{ shortWhen(t.lastMessageAt) }}</time>
          </span>
          <span class="subject">
            <span class="text-truncate">{{ t.subject }}</span>
            <span v-if="staff" class="tag" :class="t.type === 'SUPPORT' ? 'warn' : ''">{{ t.type === 'SUPPORT' ? 'Support' : 'Course' }}</span>
            <span v-if="t.status === 'CLOSED'" class="tag muted">Closed</span>
          </span>
          <span class="bottom">
            <span class="preview">{{ preview(t) }}</span>
            <span v-if="t.unread" class="count" :aria-label="`${t.unread} unread`">{{ t.unread > 9 ? '9+' : t.unread }}</span>
          </span>
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
  align-items: flex-start;
  gap: 12px;
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
.av {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  background: var(--ot-raised);
  color: var(--ot-text-2);
  border: 1px solid var(--ot-border);
}
.av img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.av.support {
  background: var(--ot-warning-bg);
  color: var(--ot-warning);
}
.av.course {
  background: var(--ot-info-bg);
  color: var(--ot-accent-tint-text);
}
.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.top,
.bottom,
.subject {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.who {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.time {
  flex: none;
  font-size: 12px;
  color: var(--ot-muted);
}
.subject {
  font-size: 13px;
  color: var(--ot-text-2);
  line-height: 1.35;
}
.tag {
  flex: none;
  font-size: 11px;
  line-height: 1;
  padding: 3px 6px;
  border-radius: var(--ot-radius-pill);
  background: var(--ot-info-bg);
  color: var(--ot-accent-tint-text);
}
.tag.warn {
  background: var(--ot-warning-bg);
  color: var(--ot-warning);
}
.tag.muted {
  background: var(--ot-raised);
  color: var(--ot-muted);
}
.preview {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--ot-muted);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.count {
  flex: none;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--ot-accent);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.trow.unread .who,
.trow.unread .preview {
  color: var(--ot-text);
}
.trow.unread .preview {
  font-weight: 500;
}
</style>
