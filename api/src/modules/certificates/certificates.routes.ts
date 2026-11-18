// Certificates.
//   GET /certificates/:number       (public verify: name, course, date, valid)
//   GET /me/certificates            (my certificates)
//   GET /me/certificates/:id/pdf    (owner or admin; generated on request)
import { Router } from 'express';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { h } from '../../lib/async.js';
import { requireAuth } from '../../middleware/auth.js';
import { loadForPdf, verifyCertificate } from './certificates.service.js';
import { renderCertificatePdf } from './certificate-pdf.js';

export const certificatesRouter = Router();

certificatesRouter.get('/certificates/:number', h(async (req, res) => res.json(await verifyCertificate(req.params.number))));

certificatesRouter.get(
  '/me/certificates',
  requireAuth,
  h(async (req, res) => {
    const rows = await prisma.certificate.findMany({
      where: { enrollment: { userId: req.user!.id } },
      orderBy: { issuedAt: 'desc' },
      include: { enrollment: { include: { course: { select: { title: true, slug: true } } } } },
    });
    res.json(rows.map((c) => ({ id: c.id, number: c.number, issuedAt: c.issuedAt, course: c.enrollment.course })));
  }),
);

certificatesRouter.get(
  '/me/certificates/:id/pdf',
  requireAuth,
  h(async (req, res) => {
    const { cert, template } = await loadForPdf(req.params.id, req.user!.id, req.user!.role === 'ADMIN');
    const pdf = await renderCertificatePdf({
      number: cert.number,
      learnerName: cert.enrollment.user.name,
      courseTitle: cert.enrollment.course.title,
      issuedAt: cert.issuedAt,
      verifyUrl: `${config.WEB_URL}/certificates/${cert.number}`,
      template,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cert.number}.pdf"`);
    res.send(Buffer.from(pdf));
  }),
);
