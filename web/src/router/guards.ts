// Route guards (UI only; the API enforces the same rules, spec section 4).
//   meta.auth -> /login?next=...; meta.admin -> ADMIN; meta.instructor -> INSTRUCTOR or ADMIN;
//   meta.partner -> PARTNER or INSTRUCTOR with a linked partner.
//   mustChangePassword -> /account/change-password first.
//   Role PARTNER may only open /partner/*, /account/change-password and public pages.
import type { Router } from 'vue-router';
import { homeFor, useAuthStore } from '@/stores/auth';

const PUBLIC_FOR_PARTNER = new Set(['home', 'course', 'certificate', 'terms', 'privacy', 'not-found', 'forbidden', 'login', 'register', 'forgot-password', 'reset-password', 'verify-email', 'course-unavailable', 'instructors', 'instructor-public']);
const GUEST_ONLY = new Set(['login', 'register', 'instructor-signup']);

export function installGuards(router: Router) {
  router.beforeEach(async (to) => {
    const auth = useAuthStore();
    await auth.ensureLoaded();
    const user = auth.user;

    if (to.meta.auth && !user) return { name: 'login', query: { next: to.fullPath } };
    if (user && GUEST_ONLY.has(String(to.name))) return homeFor(user.role);
    if (user?.mustChangePassword && to.name !== 'change-password') return { name: 'change-password' };
    if (to.meta.admin && user?.role !== 'ADMIN') return { name: 'forbidden' };
    if (to.meta.instructor && !['INSTRUCTOR', 'ADMIN'].includes(user?.role ?? '')) return { name: 'forbidden' };
    // Instructor sign-up (2026-11-27): the tools open once an admin approves the application.
    if (to.meta.instructor && !to.meta.anyStatus && user?.role === 'INSTRUCTOR' && user.instructorStatus && user.instructorStatus !== 'APPROVED') {
      return { name: 'instructor-profile' };
    }
    if (to.meta.partner) {
      const ok = user?.role === 'PARTNER' || (user?.role === 'INSTRUCTOR' && user.partner);
      if (!ok) return { name: 'forbidden' };
    }
    if (user?.role === 'PARTNER' && !to.meta.partner && to.name !== 'change-password' && !PUBLIC_FOR_PARTNER.has(String(to.name))) {
      return '/partner/revenue-sharing';
    }
    return true;
  });
}
