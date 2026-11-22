<script setup lang="ts">
// Private image attachment: fetches a short-lived signed URL, then shows the image (click to enlarge).
import { onMounted, ref } from 'vue';
import * as chatApi from '@/api/chat';
import type { Attachment } from '@/types';

const props = defineProps<{ attachment: Attachment }>();
const url = ref<string | null>(null);
const failed = ref(false);
const open = ref(false);
onMounted(async () => {
  try {
    url.value = (await chatApi.attachmentUrl(props.attachment.id)).url;
  } catch {
    failed.value = true;
  }
});
</script>

<template>
  <div class="att rounded">
    <div v-if="failed" class="pa-3 text-caption text-muted">Image unavailable</div>
    <v-img v-else-if="url" :src="url" width="160" height="120" cover alt="Attached image" class="cursor-pointer" @click="open = true" />
    <v-skeleton-loader v-else type="image" width="160" height="120" color="surface" />
    <v-dialog v-model="open" max-width="1000">
      <v-img v-if="url" :src="url" alt="Attached image" max-height="85vh" contain />
    </v-dialog>
  </div>
</template>

<style scoped>
.att {
  overflow: hidden;
  border: 1px solid var(--ot-border);
  display: inline-block;
}
</style>
