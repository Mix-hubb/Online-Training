// Payouts are RECORDS only (no money transfer). Spec 15.1.
// "Mark as paid" links all UNPAID entries of one partner in one currency (optionally up to periodTo) to a new payout.
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { writeAudit } from '../../lib/audit.js';

export interface PayoutInput {
  partnerId: string;
  currency: string;
  reference?: string;
  note?: string;
  periodFrom?: Date;
  periodTo?: Date;
  paidAt?: Date;
}

export async function markAsPaid(input: PayoutInput, adminId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.partnerId}))`;
    const where = {
      partnerId: input.partnerId,
      currency: input.currency,
      status: 'UNPAID' as const,
      ...(input.periodFrom || input.periodTo
        ? { createdAt: { ...(input.periodFrom ? { gte: input.periodFrom } : {}), ...(input.periodTo ? { lte: input.periodTo } : {}) } }
        : {}),
    };
    const entries = await tx.revenueEntry.findMany({ where, select: { id: true, amountMinor: true } });
    if (!entries.length) throw new AppError('VALIDATION_FAILED', 400, 'Nothing to pay for this partner and currency');
    const total = entries.reduce((s, e) => s + e.amountMinor, 0);
    if (total <= 0) throw new AppError('VALIDATION_FAILED', 400, 'Outstanding balance is not positive');
    const payout = await tx.partnerPayout.create({
      data: {
        partnerId: input.partnerId,
        currency: input.currency,
        totalMinor: total,
        periodFrom: input.periodFrom ?? null,
        periodTo: input.periodTo ?? null,
        paidAt: input.paidAt ?? new Date(),
        reference: input.reference ?? null,
        note: input.note ?? null,
        createdBy: adminId,
      },
    });
    const linked = await tx.revenueEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) }, status: 'UNPAID' },
      data: { status: 'PAID', payoutId: payout.id },
    });
    if (linked.count !== entries.length) throw new AppError('VALIDATION_FAILED', 409, 'Entries changed, try again');
    await writeAudit(adminId, 'payout.create', 'PartnerPayout', payout.id, { ...input, totalMinor: total, entries: entries.length }, tx);
    return payout;
  });
}
