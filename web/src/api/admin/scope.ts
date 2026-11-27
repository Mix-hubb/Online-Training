// The course editor (details, lessons, final test, uploads) is shared by admins and instructors (2026-11-27).
// The API serves the same routes under /admin and /instructor; pick the prefix from the page the user is on.
import { router } from '@/router';

export type CourseScope = '/admin' | '/instructor';

export const scope = (): CourseScope => (router.currentRoute.value.path.startsWith('/instructor') ? '/instructor' : '/admin');
