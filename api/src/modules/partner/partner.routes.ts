// Partner portal (role PARTNER, or INSTRUCTOR linked to a Partner). requireAuth + requirePartner.
// Shows ONLY the caller's own Partner record. Never learner names or emails.
//   GET /partner/summary        (earned, paid, outstanding per currency; courses with share %)
//   GET /partner/revenue?from&to&course&currency
//   GET /partner/revenue.csv
//   GET /partner/payouts
import { Router, type Request } from 'express';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { query } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePartner } from '../../middleware/roles.js';
import { payoutsOf, reportQuery, revenueRows, summary, toCsv } from '../revenue/report.service.js';

export const partnerRouter = Router();
const auth = [requireAuth, requirePartner];

/** Forces partnerId to the caller's own record, whatever the query says. */
export function ownQuery(req: Request) {
  return { ...query(req, reportQuery), partner: req.partner!.id };
}

export function stripPartner<T extends { partnerId: string; partnerName: string }>(rows: T[]) {
  return rows.map(({ partnerId: _p, partnerName: _n, ...rest }) => rest);
}

/** Totals per currency, the partner's current share of total revenue, and the courses its entries come from (for the filter). */
export async function partnerSummary(partnerId: string, q: ReturnType<typeof ownQuery>) {
  const [partner, courseIds] = await Promise.all([
    prisma.partner.findUniqueOrThrow({ where: { id: partnerId }, select: { sharePercentBp: true } }),
    prisma.revenueEntry.findMany({ where: { partnerId }, distinct: ['courseId'], select: { courseId: true } }),
  ]);
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds.map((c) => c.courseId) } },
    select: { id: true, title: true, slug: true },
    orderBy: { title: 'asc' },
  });
  return { totals: await summary(q), sharePercentBp: partner.sharePercentBp, courses };
}

partnerRouter.get(
  '/partner/summary',
  ...auth,
  h(async (req, res) => {
    const p = req.partner!;
    res.json({ partner: { id: p.id, name: p.name, logoUrl: p.logoUrl }, ...(await partnerSummary(p.id, ownQuery(req))) });
  }),
);

partnerRouter.get('/partner/revenue', ...auth, h(async (req, res) => res.json(stripPartner(await revenueRows(ownQuery(req))))));

partnerRouter.get(
  '/partner/revenue.csv',
  ...auth,
  h(async (req, res) => {
    const csv = toCsv(await revenueRows(ownQuery(req)), { includePartner: false });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="revenue-sharing.csv"');
    res.send(csv);
  }),
);

partnerRouter.get(
  '/partner/payouts',
  ...auth,
  h(async (req, res) => {
    const rows = await payoutsOf(req.partner!.id);
    res.json(rows.map(({ partner: _p, createdBy: _c, ...r }) => r));
  }),
);
