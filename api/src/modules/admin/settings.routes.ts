// Site settings. Bank details are stored as LandingSection key "bank" (no settings model in the schema).
//   GET/PUT /admin/settings/bank-details  { bankName, accountName, accountNumber, note? }
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { body } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { bankDetails } from '../payments/bank-transfer.routes.js';

export const settingsAdminRouter = Router();

settingsAdminRouter.get('/settings/bank-details', h(async (_req, res) => res.json(await bankDetails())));

settingsAdminRouter.put(
  '/settings/bank-details',
  h(async (req, res) => {
    const input = body(
      req,
      z.object({
        bankName: z.string().trim().min(1).max(100),
        accountName: z.string().trim().min(1).max(150),
        accountNumber: z.string().trim().min(1).max(50),
        note: z.string().max(500).optional(),
      }),
    );
    await prisma.landingSection.upsert({
      where: { key: 'bank' },
      create: { key: 'bank', content: input, isVisible: false },
      update: { content: input },
    });
    await writeAudit(req.user!.id, 'settings.bank_details', 'LandingSection', 'bank', { bankName: input.bankName });
    res.json(await bankDetails());
  }),
);
