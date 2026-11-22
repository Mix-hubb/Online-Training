<script setup lang="ts">
// Bell with unread count; menu shows the latest notifications.
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationsStore } from '@/stores/notifications';
import { dateTime } from '@/utils/format';
import type { AppNotification } from '@/types';

defineProps<{ framed?: boolean }>();
const store = useNotificationsStore();
const router = useRouter();
onMounted(() => store.start());

async function open(n: AppNotification) {
  await store.markRead(n.id);
  if (n.link) await router.push(n.link);
}
</script>

<template>
  <v-menu location="bottom end" :close-on-content-click="true">
    <template #activator="{ props }">
      <v-btn v-bind="props" icon :variant="framed ? 'outlined' : 'text'" :class="{ 'bell-framed': framed }" :aria-label="store.unread ? `Notifications, ${store.unread} unread` : 'Notifications'">
        <v-badge :model-value="store.unread > 0" :content="store.unread > 9 ? '9+' : store.unread" color="primary" class="square-badge">
          <v-icon icon="mdi-bell-outline" />
        </v-badge>
      </v-btn>
    </template>
    <v-card min-width="320" max-width="380" color="surface">
      <div class="d-flex align-center px-4 py-3">
        <span class="font-weight-bold">Notifications</span>
        <v-spacer />
        <v-btn v-if="store.unread" size="small" variant="text" @click.stop="store.markAll()">Mark all read</v-btn>
      </div>
      <v-divider />
      <v-list v-if="store.items.length" density="compact" max-height="380" class="py-0 bg-transparent">
        <v-list-item v-for="n in store.items.slice(0, 8)" :key="n.id" class="py-2" @click="open(n)">
          <template #prepend>
            <span class="dot mr-3" :class="{ unread: !n.readAt }" aria-hidden="true" />
          </template>
          <div class="text-body-2" :class="{ 'font-weight-medium': !n.readAt }">{{ n.text }}</div>
          <div class="text-caption text-muted">{{ dateTime(n.createdAt) }}</div>
        </v-list-item>
      </v-list>
      <div v-else class="pa-6 text-center text-body-2 text-muted">No notifications yet.</div>
    </v-card>
  </v-menu>
</template>

<style scoped>
.bell-framed {
  border-radius: var(--ot-radius-control) !important;
  width: 44px;
  height: 44px;
}
.square-badge :deep(.v-badge__badge) {
  border-radius: var(--ot-radius-control);
  font-weight: 700;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;
  display: inline-block;
}
.dot.unread {
  background: var(--ot-accent);
}
</style>
