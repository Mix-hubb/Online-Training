// Current user (from GET /auth/me), login/logout/register actions.
import { defineStore } from 'pinia';
import type { CurrentUser, Role } from '@/types';
import * as authApi from '@/api/auth';
import { ApiError } from '@/api/client';

export function homeFor(role: Role | undefined): string {
  if (role === 'PARTNER') return '/partner/revenue-sharing';
  if (role === 'INSTRUCTOR') return '/instructor';
  if (role === 'ADMIN') return '/admin';
  return '/';
}

let loading: Promise<void> | null = null;

export const useAuthStore = defineStore('auth', {
  state: () => ({ user: null as CurrentUser | null, loaded: false }),
  getters: {
    isAdmin: (s) => s.user?.role === 'ADMIN',
    isStaff: (s) => s.user?.role === 'ADMIN' || s.user?.role === 'INSTRUCTOR',
    isPartner: (s) => s.user?.role === 'PARTNER',
  },
  actions: {
    async ensureLoaded() {
      if (this.loaded) return;
      loading ??= authApi
        .me()
        .then((r) => {
          this.user = r.user;
        })
        .catch(() => {
          this.user = null;
        })
        .finally(() => {
          this.loaded = true;
          loading = null;
        });
      await loading;
    },
    async refresh() {
      this.loaded = false;
      await this.ensureLoaded();
    },
    async login(email: string, password: string) {
      const r = await authApi.login(email, password);
      this.user = r.user;
      this.loaded = true;
      return r.user;
    },
    async loginWithGoogle(credential: string) {
      const r = await authApi.google(credential);
      this.user = r.user;
      this.loaded = true;
      return r.user;
    },
    setUser(u: CurrentUser | null) {
      this.user = u;
      this.loaded = true;
    },
    async logout() {
      await authApi.logout().catch((e: unknown) => {
        if (!(e instanceof ApiError)) throw e;
      });
      this.user = null;
    },
  },
});
