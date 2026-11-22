// Admin dashboard.
//   GET /admin/dashboard  (published courses, learners, sales this month per currency, grading queue, slips, recent orders)
import { Router } from 'express';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/dashboard',
  h(async (_req, res) => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [published, drafts, learners, enrollments, sales, grading, slips, openSupport, recent] = await Promise.all([
      prisma.course.count({ where: { status: 'PUBLISHED' } }),
      prisma.course.count({ where: { status: 'DRAFT' } }),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.enrollment.count(),
      prisma.order.groupBy({ by: ['currency'], where: { status: 'PAID', paidAt: { gte: monthStart } }, _sum: { amountMinor: true }, _count: true }),
      prisma.quizAttempt.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.paymentSlip.count({ where: { status: 'PENDING' } }),
      prisma.supportThread.count({ where: { type: 'SUPPORT', status: 'OPEN' } }),
      prisma.order.findMany({
        where: { status: 'PAID' },
        orderBy: { paidAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true, email: true } }, course: { select: { title: true } } },
      }),
    ]);
    res.json({
      publishedCourses: published,
      draftCourses: drafts,
      learners,
      enrollments,
      salesThisMonth: sales.map((s) => ({ currency: s.currency, amountMinor: s._sum.amountMinor ?? 0, orders: s._count })),
      gradingWaiting: grading,
      slipsWaiting: slips,
      openSupport,
      recentOrders: recent.map((o) => ({
        id: o.id,
        paidAt: o.paidAt,
        status: o.status,
        amountMinor: o.amountMinor,
        currency: o.currency,
        method: o.method,
        user: o.user,
        course: o.course.title,
      })),
    });
  }),
);
