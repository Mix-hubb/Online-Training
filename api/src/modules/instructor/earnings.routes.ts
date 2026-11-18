// Own earnings (Partner whose userId = me). Same data as the partner portal.
//   GET /instructor/earnings        -> { linked, partner, totals, courses, rows, payouts }
//   GET /instructor/earnings.csv
import { Router } from 'express';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { query } from '../../lib/validate.js';
import { payoutsOf, reportQuery, revenueRows, toCsv } from '../revenue/report.service.js';
import { partnerSummary, stripPartner } from '../partner/partner.routes.js';

export const instructorEarningsRouter = Router();

instructorEarningsRouter.get(
  '/earnings',
  h(async (req, res) => {
    const partner = await prisma.partner.findUnique({ where: { userId: req.user!.id } });
    if (!partner) return res.json({ linked: false });
    const q = { ...query(req, reportQuery), partner: partner.id };
    const payouts = await payoutsOf(partner.id);
    res.json({
      linked: true,
      partner: { id: partner.id, name: partner.name },
      ...(await partnerSummary(partner.id, q)),
      rows: stripPartner(await revenueRows(q)),
      payouts: payouts.map(({ partner: _p, createdBy: _c, ...r }) => r),
    });
  }),
);

instructorEarningsRouter.get(
  '/earnings.csv',
  h(async (req, res) => {
    const partner = await prisma.partner.findUnique({ where: { userId: req.user!.id } });
    if (!partner) throw new AppError('NOT_A_PARTNER', 403);
    const csv = toCsv(await revenueRows({ ...query(req, reportQuery), partner: partner.id }), { includePartner: false });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="earnings.csv"');
    res.send(csv);
  }),
);
