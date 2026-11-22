// Partner routes. meta.partner: role PARTNER, or INSTRUCTOR with a linked Partner.
import type { RouteRecordRaw } from 'vue-router';

const meta = { auth: true, partner: true, layout: 'partner' } as const;

export const partnerRoutes: RouteRecordRaw[] = [
  { path: '/partner', redirect: '/partner/revenue-sharing' },
  { path: '/partner/revenue-sharing', name: 'partner-revenue', component: () => import('@/pages/partner/RevenueSharingPage.vue'), meta },
  { path: '/partner/payouts', name: 'partner-payouts', component: () => import('@/pages/partner/PayoutsPage.vue'), meta },
];
