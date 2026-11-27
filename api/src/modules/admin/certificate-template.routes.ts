// Certificate template (singleton row id = 1).
//   GET /admin/certificate-template
//   PUT /admin/certificate-template
//   GET /admin/certificate-template/preview.pdf
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { h } from '../../lib/async.js';
import { body } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { renderCertificatePdf } from '../certificates/certificate-pdf.js';

export const certificateTemplateAdminRouter = Router();

const getTemplate = async () =>
  (await prisma.certificateTemplate.findUnique({ where: { id: 1 } })) ?? prisma.certificateTemplate.create({ data: { id: 1 } });

certificateTemplateAdminRouter.get('/certificate-template', h(async (_req, res) => res.json(await getTemplate())));

certificateTemplateAdminRouter.put(
  '/certificate-template',
  h(async (req, res) => {
    const input = body(
      req,
      z.object({
        heading: z.string().trim().min(1).max(80),
        issuerName: z.string().max(120),
        // Not on the 2026-11-27 layout (stamp + issuer name instead); kept for older clients.
        signerName: z.string().max(120).optional(),
        signerTitle: z.string().max(120).optional(),
        logoUrl: z.string().url().nullable(),
        signatureUrl: z.string().url().nullable().optional(),
        stampUrl: z.string().url().nullable().optional(),
        primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    );
    const t = await prisma.certificateTemplate.upsert({ where: { id: 1 }, create: { id: 1, ...input }, update: input });
    await writeAudit(req.user!.id, 'certificate_template.update', 'CertificateTemplate', '1', input);
    res.json(t);
  }),
);

certificateTemplateAdminRouter.get(
  '/certificate-template/preview.pdf',
  h(async (req, res) => {
    const pdf = await renderCertificatePdf({
      number: 'OT-0000-000000',
      learnerName: req.user!.name || 'Sample Learner',
      courseTitle: 'Sample Course Title',
      issuedAt: new Date(),
      verifyUrl: `${config.WEB_URL}/certificates/OT-0000-000000`,
      template: await getTemplate(),
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdf));
  }),
);
