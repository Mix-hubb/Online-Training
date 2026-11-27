// Instructor routes (change request 15.2). meta.instructor: role INSTRUCTOR or ADMIN.
import type { RouteRecordRaw } from 'vue-router';

const meta = { auth: true, instructor: true, layout: 'instructor' } as const;

export const instructorRoutes: RouteRecordRaw[] = [
  { path: '/instructor', name: 'instructor-dashboard', component: () => import('@/pages/instructor/InstructorDashboardPage.vue'), meta },
  // Own profile and application status: open in every status (pending / rejected instructors land here).
  { path: '/instructor/profile', name: 'instructor-profile', component: () => import('@/pages/instructor/InstructorProfilePage.vue'), meta: { ...meta, anyStatus: true } },
  // Own courses (2026-11-27): the shared course editor, served from /instructor/* API routes (api/admin/scope.ts).
  { path: '/instructor/courses/new', name: 'instructor-course-new', component: () => import('@/pages/admin/courses/CourseEditorPage.vue'), meta },
  { path: '/instructor/courses/:id', name: 'instructor-course-edit', component: () => import('@/pages/admin/courses/CourseEditorPage.vue'), meta },
  { path: '/instructor/courses/:id/preview', name: 'instructor-course-preview', component: () => import('@/pages/admin/courses/CoursePreviewPage.vue'), meta: { ...meta, layout: 'public' } },
  { path: '/instructor/courses/:id/learners', name: 'instructor-learners', component: () => import('@/pages/instructor/InstructorLearnersPage.vue'), meta },
  { path: '/instructor/courses/:id/quiz', name: 'instructor-quiz', component: () => import('@/pages/instructor/InstructorQuizPage.vue'), meta },
  { path: '/instructor/grading/:attemptId?', name: 'instructor-grading', component: () => import('@/pages/instructor/InstructorGradingPage.vue'), meta },
  { path: '/instructor/messages/:threadId?', name: 'instructor-messages', component: () => import('@/pages/instructor/InstructorMessagesPage.vue'), meta },
  { path: '/instructor/earnings', name: 'instructor-earnings', component: () => import('@/pages/instructor/InstructorEarningsPage.vue'), meta },
];
