// User-facing routes (spec section 5). meta.auth = must be logged in.
import type { RouteRecordRaw } from 'vue-router';

export const userRoutes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/pages/user/HomePage.vue') },

  // Auth (login + register are tabs on one page)
  { path: '/login', name: 'login', component: () => import('@/pages/user/auth/AuthPage.vue'), props: { tab: 'login' } },
  { path: '/register', name: 'register', component: () => import('@/pages/user/auth/AuthPage.vue'), props: { tab: 'register' } },
  { path: '/verify-email', name: 'verify-email', component: () => import('@/pages/user/auth/VerifyEmailPage.vue') },
  { path: '/forgot-password', name: 'forgot-password', component: () => import('@/pages/user/auth/ForgotPasswordPage.vue') },
  { path: '/account/change-password', name: 'change-password', component: () => import('@/pages/user/auth/ChangePasswordPage.vue'), meta: { auth: true } },
  { path: '/reset-password', name: 'reset-password', component: () => import('@/pages/user/auth/ResetPasswordPage.vue') },

  // Catalog
  { path: '/courses/:slug', name: 'course', component: () => import('@/pages/user/course/CoursePage.vue') },

  // Stripe success_url is /profile/orders?session_id=... (Figma shows "Confirming payment" on Orders).
  // /checkout/return stays as an alias that forwards there.
  { path: '/checkout/return', name: 'checkout-return', component: () => import('@/pages/user/checkout/CheckoutReturnPage.vue'), meta: { auth: true } },

  { path: '/checkout/bank-transfer/:orderId', name: 'checkout-bank-transfer', component: () => import('@/pages/user/checkout/BankTransferPage.vue'), meta: { auth: true } },

  // Private chat (change request 15.4)
  { path: '/messages/:threadId?', name: 'messages', component: () => import('@/pages/user/messages/MessagesPage.vue'), meta: { auth: true } },

  // Learning
  { path: '/learn/:slug', name: 'learn', component: () => import('@/pages/user/learn/LearnPage.vue'), meta: { auth: true } },
  { path: '/learn/:slug/quiz', name: 'quiz', component: () => import('@/pages/user/learn/QuizPage.vue'), meta: { auth: true } },
  { path: '/learn/:slug/result/:attemptId?', name: 'quiz-result', component: () => import('@/pages/user/learn/ResultPage.vue'), meta: { auth: true } },

  // Profile
  { path: '/profile', name: 'profile', component: () => import('@/pages/user/profile/ProfilePage.vue'), meta: { auth: true } },
  { path: '/profile/orders', name: 'orders', component: () => import('@/pages/user/profile/OrdersPage.vue'), meta: { auth: true } },

  // Public certificate verification
  { path: '/certificates/:number?', name: 'certificate', component: () => import('@/pages/public/CertificatePage.vue') },

  // Error / empty states reachable by name
  { path: '/course-unavailable', name: 'course-unavailable', component: () => import('@/pages/errors/CourseUnavailablePage.vue') },
  { path: '/locked', name: 'locked', component: () => import('@/pages/errors/LockedPage.vue') },
];
