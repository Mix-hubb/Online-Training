// Revenue share report, CSV, balances, payouts. Spec 15.1.
//   GET  /admin/revenue?from&to&course&partner&currency&status  -> { summary, rows }
//   GET  /admin/revenue.csv
//   GET  /admin/revenue/balances
//   POST /admin/revenue/payouts  { partnerId, currency, reference?, note?, periodFrom?, periodTo? }  (Mark as paid)
//   GET  /admin/revenue/payouts?partner
import { Router } from 'express';
import { z } from 'zod';
import { h } from '../../lib/async.js';
import { body, query } from '../../lib/validate.js';
import { markAsPaid } from '../revenue/payout.service.js';
import { balances, countRows, daily, payoutsOf, reportQuery, revenueRows, summary, TABLE_ROWS, toCsv } from '../revenue/report.service.js';

export const revenueAdminRouter = Router();

revenueAdminRouter.get(
  '/revenue',
  h(async (req, res) => {
    const q = query(req, reportQuery);
    const [s, rows, total, days] = await Promise.all([summary(q), revenueRows(q, TABLE_ROWS), countRows(q), daily(q)]);
    res.json({ summary: s, rows, total, daily: days });
  }),
);

revenueAdminRouter.get(
  '/revenue.csv',
  h(async (req, res) => {
    const csv = toCsv(await revenueRows(query(req, reportQuery)), { includePartner: true });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="revenue.csv"');
    res.send(csv);
  }),
);

revenueAdminRouter.get('/revenue/balances', h(async (_req, res) => res.json(await balances())));

revenueAdminRouter.post(
  '/revenue/payouts',
  h(async (req, res) => {
    const input = body(
      req,
      z.object({
        partnerId: z.string().min(1),
        currency: z.enum(['usd', 'thb']),
        reference: z.string().max(200).optional(),
        note: z.string().max(1000).optional(),
        periodFrom: z.coerce.date().optional(),
        periodTo: z.coerce.date().optional(),
        paidAt: z.coerce.date().optional(),
      }),
    );
    res.status(201).json(await markAsPaid(input, req.user!.id));
  }),
);

revenueAdminRouter.get(
  '/revenue/payouts',
  h(async (req, res) => res.json(await payoutsOf(query(req, z.object({ partner: z.string().optional() })).partner))),
);
