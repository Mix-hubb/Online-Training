<script setup lang="ts">
// Message box with up to 3 images (jpg/png/webp, 5 MB each). Enter sends, Shift+Enter adds a line.
import { ref } from 'vue';
import { fileToBase64 } from '@/api/client';
import type { MessageInput } from '@/api/chat';

const props = defineProps<{ loading?: boolean; disabled?: boolean; placeholder?: string }>();
const emit = defineEmits<{ send: [MessageInput] }>();
const body = ref('');
const files = ref<File[]>([]);
const err = ref('');
const input = ref<HTMLInputElement | null>(null);

function add(e: Event) {
  err.value = '';
  const list = Array.from((e.target as HTMLInputElement).files ?? []);
  for (const f of list) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) err.value = 'Only JPG, PNG or WebP images.';
    else if (f.size > 5 * 1024 * 1024) err.value = 'Each image must be 5 MB or smaller.';
    else if (files.value.length >= 3) err.value = 'Up to 3 images per message.';
    else files.value.push(f);
  }
  (e.target as HTMLInputElement).value = '';
}
const preview = (f: File) => URL.createObjectURL(f);

async function send() {
  if (props.loading || props.disabled) return;
  if (!body.value.trim() && !files.value.length) return;
  const attachments = await Promise.all(files.value.map(async (f) => ({ name: f.name, dataBase64: await fileToBase64(f) })));
  emit('send', { body: body.value.trim(), attachments });
}
function reset() {
  body.value = '';
  files.value = [];
}
defineExpose({ reset });
function key(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    void send();
  }
}
</script>

<template>
  <div class="composer">
    <div v-if="files.length" class="d-flex flex-wrap ga-2">
      <span v-for="(f, i) in files" :key="i" class="file">
        <img :src="preview(f)" alt="" />
        {{ f.name }} · {{ (f.size / 1024 / 1024).toFixed(1) }} MB
        <button type="button" class="rm" :aria-label="`Remove ${f.name}`" @click="files.splice(i, 1)">×</button>
      </span>
    </div>
    <div v-if="err" class="text-caption" style="color: var(--ot-danger)" role="alert">{{ err }}</div>
    <div class="d-flex align-end ga-2">
      <button type="button" class="attach" :disabled="disabled || files.length >= 3" aria-label="Attach images" @click="input?.click()"><v-icon icon="mdi-paperclip" size="20" /></button>
      <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden @change="add" />
      <label for="chat-msg" class="sr-only">Message</label>
      <textarea id="chat-msg" v-model="body" class="box" rows="2" :placeholder="placeholder ?? 'Write a message'" :disabled="disabled" maxlength="2000" @keydown="key" />
      <v-btn color="primary" min-height="46" class="px-5" :loading="loading" :disabled="disabled" @click="send">Send</v-btn>
    </div>
    <span class="text-caption text-muted">JPG, PNG or WebP. Up to 3 images per message, 5 MB each. Enter sends, Shift+Enter adds a line.</span>
  </div>
</template>

<style scoped>
.composer {
  border-top: 1px solid var(--ot-border);
  padding: 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.file {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ot-text-2);
  border: 1px solid var(--ot-input-border);
  background: var(--ot-deep);
  border-radius: var(--ot-radius-control);
  padding: 4px 8px 4px 4px;
}
.file img {
  width: 28px;
  height: 28px;
  object-fit: cover;
  border-radius: var(--ot-radius-pill);
}
.rm {
  border: 0;
  background: transparent;
  color: var(--ot-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
}
.attach {
  flex: none;
  width: 46px;
  height: 46px;
  border-radius: var(--ot-radius-control);
  border: 1px solid var(--ot-input-border);
  background: var(--ot-surface);
  color: var(--ot-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--ot-shadow-btn);
}
.attach:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.box {
  flex: 1;
  resize: none;
  padding: 12px 14px;
  border-radius: var(--ot-radius-control);
  border: 1px solid var(--ot-input-border);
  background: var(--ot-surface);
  color: var(--ot-text);
  font-size: 14px;
  line-height: 1.5;
  min-width: 0;
}
.box:focus {
  outline: 2px solid var(--ot-accent);
  outline-offset: -1px;
}
</style>
