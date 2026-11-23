// Admin routes (spec section 5). All require role ADMIN (see guards.ts).
import type { RouteRecordRaw } from 'vue-router';

const meta = { auth: true, admin: true, layout: 'admin' } as const;

export const adminRoutes: RouteRecordRaw[] = [
  { path: '/admin', name: 'admin-dashboard', component: () => import('@/pages/admin/DashboardPage.vue'), meta },
  { path: '/admin/courses', name: 'admin-courses', component: () => import('@/pages/admin/courses/CourseListPage.vue'), meta },
  { path: '/admin/courses/new', name: 'admin-course-new', component: () => import('@/pages/admin/courses/CourseEditorPage.vue'), meta },
  { path: '/admin/courses/:id', name: 'admin-course-edit', component: () => import('@/pages/admin/courses/CourseEditorPage.vue'), meta },
  { path: '/admin/courses/:id/preview', name: 'admin-course-preview', component: () => import('@/pages/admin/courses/CoursePreviewPage.vue'), meta: { ...meta, layout: 'public' } },
  { path: '/admin/grading', name: 'admin-grading', component: () => import('@/pages/admin/grading/GradingQueuePage.vue'), meta },
  { path: '/admin/grading/:attemptId', name: 'admin-grading-attempt', component: () => import('@/pages/admin/grading/GradingAttemptPage.vue'), meta },
  { path: '/admin/landing', name: 'admin-landing', component: () => import('@/pages/admin/LandingEditorPage.vue'), meta },
  { path: '/admin/taxonomy', name: 'admin-taxonomy', component: () => import('@/pages/admin/TaxonomyPage.vue'), meta },
  { path: '/admin/users', name: 'admin-users', component: () => import('@/pages/admin/UsersPage.vue'), meta },
  { path: '/admin/certificate', name: 'admin-certificate', component: () => import('@/pages/admin/CertificateTemplatePage.vue'), meta },
  { path: '/admin/instructors', name: 'admin-instructors', component: () => import('@/pages/admin/InstructorsPage.vue'), meta },
  { path: '/admin/partners', name: 'admin-partners', component: () => import('@/pages/admin/PartnersPage.vue'), meta },
  { path: '/admin/revenue', name: 'admin-revenue', component: () => import('@/pages/admin/RevenuePage.vue'), meta },
  { path: '/admin/support/:threadId?', name: 'admin-support', component: () => import('@/pages/admin/SupportInboxPage.vue'), meta },
  { path: '/admin/payments/review', name: 'admin-payment-review', component: () => import('@/pages/admin/PaymentReviewPage.vue'), meta },
  { path: '/admin/settings', name: 'admin-settings', component: () => import('@/pages/admin/SettingsPage.vue'), meta },
  { path: '/admin/reviews', name: 'admin-reviews', component: () => import('@/pages/admin/ReviewsPage.vue'), meta },
  { path: '/admin/audit', name: 'admin-audit', component: () => import('@/pages/admin/AuditLogPage.vue'), meta },
];
