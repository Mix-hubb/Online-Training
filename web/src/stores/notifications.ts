// Notifications store: unread count for the bell, list for the profile page.
import { defineStore } from 'pinia';
import * as api from '@/api/notifications';
import type { AppNotification } from '@/types';

let timer: ReturnType<typeof setInterval> | null = null;

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({ items: [] as AppNotification[], unread: 0 }),
  actions: {
    async refresh() {
      try {
        const r = await api.list();
        this.items = r.items;
        this.unread = r.unread;
      } catch {
        /* logged out or offline */
      }
    },
    start() {
      if (timer) return;
      void this.refresh();
      timer = setInterval(() => void this.refresh(), 60_000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      this.items = [];
      this.unread = 0;
    },
    async markRead(id: string) {
      const n = this.items.find((x) => x.id === id);
      if (n && !n.readAt) {
        n.readAt = new Date().toISOString();
        this.unread = Math.max(0, this.unread - 1);
      }
      await api.read(id);
    },
    async markAll() {
      await api.readAll();
      this.items.forEach((n) => (n.readAt ??= new Date().toISOString()));
      this.unread = 0;
    },
  },
});
