// Partners (spec 15.1, 15.9). A partner is a co-investor (role PARTNER login, logo on the site)
// or an instructor with a revenue share (userId = an INSTRUCTOR account).
//   GET    /admin/partners?include=instructors   co-investors only by default; instructors (their Partner row holds
//          ledger entries and payouts) are managed on /admin/instructors and listed here only on request
//   POST   /admin/partners                 { name, contact?, websiteUrl?, showLogo?, logoOrder?, logoUrl?, userId?, sharePercentBp? }
//          sharePercentBp = co-investor share (basis points) of each sale AFTER that course's instructor shares.
//          Sum over all partners <= 10000. Must be 0 for a partner linked to an INSTRUCTOR account
//          (instructors are paid per course: PATCH /admin/courses/:id/instructors/:userId).
//          A new percent only applies to orders paid after the change (entries keep their snapshot).
//   PATCH  /admin/partners/:id
//   POST   /admin/partners/:id/logo        { file }  (public image)
//   PUT    /admin/partners/logo-order      { ids }
//   POST   /admin/partners/:id/account     { email }  -> PARTNER login; temporary password returned ONCE
//   POST   /admin/partners/:id/account/reset-password  -> FALLBACK only (partner should use "Forgot password?" first)
//   DELETE /admin/partners/:id             (blocked while a share or ledger entries exist)
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma, type Tx } from '../../db.js';
import { MAX_TOTAL_SHARE_BP } from '../revenue/ledger.service.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body, email } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { tempPassword } from '../../lib/tokens.js';
import { decodeImage, fileInput } from '../../lib/attachments.js';
import { storage } from '../../providers/storage/index.js';

export const partnersAdminRouter = Router();

const fields = z.object({
  name: z.string().trim().min(1).max(150),
  contact: z.string().max(300).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  showLogo: z.boolean().optional(),
  logoOrder: z.number().int().optional(),
  userId: z.string().nullable().optional(),
  sharePercentBp: z.number().int().min(0).max(MAX_TOTAL_SHARE_BP).optional(),
});

/** Sum of every partner's share must stay <= 100%. Runs inside the write transaction under a lock. */
async function checkTotalShare(tx: Tx, sharePercentBp: number | undefined, partnerId?: string) {
  if (sharePercentBp === undefined) return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('partner_share_total'))`;
  const others = await tx.partner.aggregate({ where: partnerId ? { id: { not: partnerId } } : {}, _sum: { sharePercentBp: true } });
  const total = (others._sum.sharePercentBp ?? 0) + sharePercentBp;
  if (total > MAX_TOTAL_SHARE_BP) {
    throw new AppError('VALIDATION_FAILED', 400, `Partner shares add up to ${(total / 100).toFixed(2)}%, the maximum is 100%`);
  }
}

async function checkLinkUser(userId: string | null | undefined, partnerId?: string) {
  if (!userId) return;
  const u = await prisma.user.findUnique({ where: { id: userId }, include: { partnerLink: true } });
  if (!u) throw new AppError('NOT_FOUND', 404, 'User not found');
  if (u.role !== 'INSTRUCTOR' && u.role !== 'PARTNER') throw new AppError('VALIDATION_FAILED', 400, 'Link only an INSTRUCTOR or PARTNER account');
  if (u.partnerLink && u.partnerLink.id !== partnerId) throw new AppError('VALIDATION_FAILED', 409, 'This account is already linked to another partner');
}

/** Instructors get a share per course, never a share of all sales. */
async function checkNoInstructorShare(userId: string | null | undefined, sharePercentBp: number | undefined) {
  if (!userId || !sharePercentBp) return;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (u?.role === 'INSTRUCTOR') {
    throw new AppError('VALIDATION_FAILED', 400, "An instructor's share is set per course, in the course's Instructors tab");
  }
}

async function listPartners(includeInstructors = false) {
  const [rows, unpaid] = await Promise.all([
    prisma.partner.findMany({
      where: includeInstructors ? {} : { OR: [{ userId: null }, { user: { role: { not: 'INSTRUCTOR' } } }] },
      orderBy: [{ logoOrder: 'asc' }, { name: 'asc' }],
      include: {
        user: { select: { id: true, email: true, role: true, status: true, mustChangePassword: true } },
      },
    }),
    prisma.revenueEntry.groupBy({ by: ['partnerId', 'currency'], where: { status: 'UNPAID' }, _sum: { amountMinor: true } }),
  ]);
  return rows.map((p) => ({
    ...p,
    kind: p.user?.role === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'CO_INVESTOR',
    outstanding: unpaid.filter((u) => u.partnerId === p.id).map((u) => ({ currency: u.currency, amountMinor: u._sum.amountMinor ?? 0 })),
  }));
}

partnersAdminRouter.get('/partners', h(async (req, res) => res.json(await listPartners(req.query.include === 'instructors'))));

partnersAdminRouter.post(
  '/partners',
  h(async (req, res) => {
    const input = body(req, fields);
    await checkLinkUser(input.userId);
    await checkNoInstructorShare(input.userId, input.sharePercentBp);
    const p = await prisma.$transaction(async (tx) => {
      await checkTotalShare(tx, input.sharePercentBp);
      const created = await tx.partner.create({ data: input });
      await writeAudit(req.user!.id, 'partner.create', 'Partner', created.id, input, tx);
      return created;
    });
    res.status(201).json(p);
  }),
);

partnersAdminRouter.put(
  '/partners/logo-order',
  h(async (req, res) => {
    const { ids } = body(req, z.object({ ids: z.array(z.string()).min(1) }));
    await prisma.$transaction(ids.map((id, i) => prisma.partner.update({ where: { id }, data: { logoOrder: i + 1 } })));
    await writeAudit(req.user!.id, 'partner.logo_order', 'Partner', null, { ids });
    res.json(await listPartners());
  }),
);

partnersAdminRouter.patch(
  '/partners/:id',
  h(async (req, res) => {
    const input = body(req, fields.partial());
    await checkLinkUser(input.userId, req.params.id);
    const p = await prisma.$transaction(async (tx) => {
      const current = await tx.partner.findUnique({ where: { id: req.params.id } });
      if (!current) throw new AppError('NOT_FOUND', 404);
      await checkNoInstructorShare(
        input.userId !== undefined ? input.userId : current.userId,
        input.sharePercentBp ?? current.sharePercentBp,
      );
      await checkTotalShare(tx, input.sharePercentBp, req.params.id);
      const updated = await tx.partner.update({ where: { id: req.params.id }, data: input });
      await writeAudit(req.user!.id, 'partner.update', 'Partner', updated.id, input, tx);
      return updated;
    });
    res.json(p);
  }),
);

partnersAdminRouter.post(
  '/partners/:id/logo',
  h(async (req, res) => {
    const { file } = body(req, z.object({ file: fileInput }));
    const img = decodeImage(file);
    const url = await storage.putPublic(`logo/${crypto.randomUUID()}.${img.ext}`, img.buffer, img.mime);
    const p = await prisma.partner.update({ where: { id: req.params.id }, data: { logoUrl: url } }).catch(() => {
      throw new AppError('NOT_FOUND', 404);
    });
    await writeAudit(req.user!.id, 'partner.logo', 'Partner', p.id, { logoUrl: url });
    res.json(p);
  }),
);

partnersAdminRouter.post(
  '/partners/:id/account',
  h(async (req, res) => {
    const input = body(req, z.object({ email }));
    const partner = await prisma.partner.findUnique({ where: { id: req.params.id } });
    if (!partner) throw new AppError('NOT_FOUND', 404);
    if (partner.userId) throw new AppError('VALIDATION_FAILED', 409, 'This partner already has a login');
    if (await prisma.user.findUnique({ where: { email: input.email } })) {
      throw new AppError('VALIDATION_FAILED', 409, 'An account with this email already exists');
    }
    const password = tempPassword();
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: input.email,
          name: partner.name,
          role: 'PARTNER',
          passwordHash: await bcrypt.hash(password, 10),
          emailVerifiedAt: new Date(),
          mustChangePassword: true,
        },
      });
      await tx.partner.update({ where: { id: partner.id }, data: { userId: u.id } });
      // Never put the password in the audit log.
      await writeAudit(req.user!.id, 'partner.account_create', 'Partner', partner.id, { email: u.email }, tx);
      return u;
    });
    res.status(201).json({ email: user.email, temporaryPassword: password });
  }),
);

partnersAdminRouter.post(
  '/partners/:id/account/reset-password',
  h(async (req, res) => {
    const partner = await prisma.partner.findUnique({ where: { id: req.params.id }, include: { user: true } });
    if (!partner?.user) throw new AppError('NOT_FOUND', 404, 'This partner has no login');
    if (partner.user.role !== 'PARTNER') throw new AppError('VALIDATION_FAILED', 400, 'Only PARTNER logins are reset here');
    const password = tempPassword();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: partner.user!.id }, data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true } });
      await tx.authToken.updateMany({ where: { userId: partner.user!.id, type: 'RESET', usedAt: null }, data: { usedAt: new Date() } });
      await writeAudit(req.user!.id, 'partner.password_reset', 'Partner', partner.id, { email: partner.user!.email }, tx);
    });
    res.json({ email: partner.user.email, temporaryPassword: password });
  }),
);

partnersAdminRouter.delete(
  '/partners/:id',
  h(async (req, res) => {
    const p = await prisma.partner.findUnique({ where: { id: req.params.id }, include: { _count: { select: { entries: true, payouts: true } } } });
    if (!p) throw new AppError('NOT_FOUND', 404);
    if (p.sharePercentBp > 0 || p._count.entries || p._count.payouts) {
      throw new AppError('VALIDATION_FAILED', 409, 'This partner has a share or ledger history. Set the share to 0% and hide the logo instead.');
    }
    await prisma.partner.delete({ where: { id: p.id } });
    await writeAudit(req.user!.id, 'partner.delete', 'Partner', p.id, { name: p.name });
    res.json({ ok: true });
  }),
);
