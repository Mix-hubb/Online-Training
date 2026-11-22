<script setup lang="ts">
// Learner messages (spec 15.4): support thread with admins, course threads with the course's instructors.
// ?course=<id> opens the "new message" dialog for that course (from the player).
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ChatWorkspace from '@/components/chat/ChatWorkspace.vue';
import MessageComposer from '@/components/chat/MessageComposer.vue';
import * as chatApi from '@/api/chat';
import * as learningApi from '@/api/learning';
import { errorMessage } from '@/api/client';
import type { MyCourse } from '@/types';

const route = useRoute();
const router = useRouter();
const dialog = ref(false);
const to = ref<string>('support');
const subject = ref('');
const courses = ref<MyCourse[]>([]);
const busy = ref(false);
const err = ref('');
const ws = ref<InstanceType<typeof ChatWorkspace> | null>(null);

onMounted(async () => {
  courses.value = await learningApi.myCourses().catch(() => []);
  if (route.query.course) {
    const c = courses.value.find((x) => x.course.id === route.query.course);
    if (c) {
      to.value = c.course.id;
      subject.value = `Question about ${c.course.title}`;
      dialog.value = true;
    }
    void router.replace({ query: {} });
  }
});

async function start(m: chatApi.MessageInput) {
  err.value = '';
  if (!subject.value.trim()) return void (err.value = 'Add a subject.');
  busy.value = true;
  try {
    const r = to.value === 'support' ? await chatApi.openSupport(subject.value.trim(), m) : await chatApi.openCourseThread(to.value, subject.value.trim(), m);
    dialog.value = false;
    subject.value = '';
    await ws.value?.refreshThreads();
    ws.value?.select(r.id);
  } catch (e) {
    err.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <div class="mb-5"><h1 class="page-title mb-1">Messages</h1><p class="page-sub">Ask the support team, or the instructors of the courses you take.</p></div>
    <ChatWorkspace ref="ws" base-path="/messages" :load-threads="chatApi.myThreads" title="Conversations">
      <template #actions><v-btn size="small" color="primary" @click="dialog = true">New message</v-btn></template>
    </ChatWorkspace>
    <v-dialog v-model="dialog" max-width="560">
      <v-card color="surface">
        <v-card-title class="pt-5 px-6 font-weight-bold">New message</v-card-title>
        <div class="px-6">
          <v-alert v-if="err" type="error" variant="tonal" density="compact" class="mb-3">{{ err }}</v-alert>
          <v-select
            v-model="to"
            label="Send to"
            variant="outlined"
            :items="[{ title: 'Support team', value: 'support' }, ...courses.map((c) => ({ title: `Instructor · ${c.course.title}`, value: c.course.id }))]"
            class="mb-2"
          />
          <v-text-field v-model="subject" label="Subject" maxlength="200" />
        </div>
        <MessageComposer :loading="busy" placeholder="Describe your question" @send="start" />
      </v-card>
    </v-dialog>
  </div>
</template>
