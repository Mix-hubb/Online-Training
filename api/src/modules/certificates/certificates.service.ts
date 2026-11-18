// Issue certificate (one per enrollment). Number format OT-<year>-<6 digits>, unique, sequential per year.
import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../../db.js';
import { AppError } from '../../lib/errors.js';

export function formatCertNumber(year: number, seq: number) {
  return `OT-${year}-${String(seq).padStart(6, '0')}`;
}

export async function nextCertNumber(tx: Tx, year = new Date().getFullYear()) {
  const last = await tx.certificate.findFirst({
    where: { number: { startsWith: `OT-${year}-` } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const seq = last ? parseInt(last.number.slice(-6), 10) + 1 : 1;
  return formatCertNumber(year, seq);
}

export async function issueCertificate(tx: Tx, enrollmentId: string, attemptId: string) {
  const existing = await tx.certificate.findUnique({ where: { enrollmentId } });
  if (existing) return existing;
  // Serialize number allocation across concurrent transactions.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(4207)`;
  const number = await nextCertNumber(tx);
  return tx.certificate.create({ data: { number, enrollmentId, attemptId } });
}

export async function verifyCertificate(number: string) {
  const c = await prisma.certificate.findUnique({
    where: { number },
    include: { enrollment: { include: { user: { select: { name: true } }, course: { select: { title: true, slug: true } } } } },
  });
  if (!c) throw new AppError('NOT_FOUND', 404);
  return {
    number: c.number,
    name: c.enrollment.user.name,
    course: c.enrollment.course.title,
    courseSlug: c.enrollment.course.slug,
    issuedAt: c.issuedAt,
    valid: true,
  };
}

export async function loadForPdf(id: string, userId: string, isAdmin: boolean) {
  const c = await prisma.certificate.findUnique({
    where: { id },
    include: { enrollment: { include: { user: true, course: true } } },
  });
  if (!c || (!isAdmin && c.enrollment.userId !== userId)) throw new AppError('NOT_FOUND', 404);
  const template =
    (await prisma.certificateTemplate.findUnique({ where: { id: 1 } })) ??
    (await prisma.certificateTemplate.create({ data: { id: 1 } }));
  return { cert: c, template };
}

export type { Prisma };
