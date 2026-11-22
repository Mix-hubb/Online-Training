import { createRouter, createWebHistory } from 'vue-router';
import { userRoutes } from './user.routes';
import { adminRoutes } from './admin.routes';
import { instructorRoutes } from './instructor.routes';
import { partnerRoutes } from './partner.routes';
import { installGuards } from './guards';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...userRoutes,
    ...adminRoutes,
    ...instructorRoutes,
    ...partnerRoutes,
    { path: '/403', name: 'forbidden', component: () => import('@/pages/errors/ForbiddenPage.vue') },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/errors/NotFoundPage.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

installGuards(router);
