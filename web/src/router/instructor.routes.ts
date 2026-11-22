// Instructor routes (change request 15.2). meta.instructor: role INSTRUCTOR or ADMIN.
import type { RouteRecordRaw } from 'vue-router';

const meta = { auth: true, instructor: true, layout: 'instructor' } as const;

export const instructorRoutes: RouteRecordRaw[] = [
  { path: '/instructor', name: 'instructor-dashboard', component: () => import('@/pages/instructor/InstructorDashboardPage.vue'), meta },
  { path: '/instructor/courses/:id/learners', name: 'instructor-learners', component: () => import('@/pages/instructor/InstructorLearnersPage.vue'), meta },
  { path: '/instructor/courses/:id/quiz', name: 'instructor-quiz', component: () => import('@/pages/instructor/InstructorQuizPage.vue'), meta },
  { path: '/instructor/grading/:attemptId?', name: 'instructor-grading', component: () => import('@/pages/instructor/InstructorGradingPage.vue'), meta },
  { path: '/instructor/messages/:threadId?', name: 'instructor-messages', component: () => import('@/pages/instructor/InstructorMessagesPage.vue'), meta },
  { path: '/instructor/earnings', name: 'instructor-earnings', component: () => import('@/pages/instructor/InstructorEarningsPage.vue'), meta },
];
