// API: admin dashboard.
import { get } from '../client';

export interface Dashboard {
  publishedCourses: number;
  draftCourses: number;
  learners: number;
  enrollments: number;
  salesThisMonth: { currency: string; amountMinor: number; orders: number }[];
  gradingWaiting: number;
  slipsWaiting: number;
  openSupport: number;
  recentOrders: { id: string; paidAt: string; status: string; amountMinor: number; currency: string; method: string | null; user: { name: string; email: string }; course: string }[];
}
export const dashboard = () => get<Dashboard>('/admin/dashboard');
