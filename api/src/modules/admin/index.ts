// Admin router: requireAuth + requireAdmin on everything under /admin.
// Every mutation calls writeAudit() (lib/audit.ts).
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { h } from '../../lib/async.js';
import { body } from '../../lib/validate.js';
import { decodeImage, fileInput } from '../../lib/attachments.js';
import { writeAudit } from '../../lib/audit.js';
import { storage } from '../../providers/storage/index.js';
import { dashboardRouter } from './dashboard.routes.js';
import { coursesAdminRouter } from './courses.routes.js';
import { lessonsAdminRouter } from './lessons.routes.js';
import { quizAdminRouter } from './quiz.routes.js';
import { gradingAdminRouter } from './grading.routes.js';
import { landingAdminRouter } from './landing.routes.js';
import { taxonomyAdminRouter } from './taxonomy.routes.js';
import { usersAdminRouter } from './users.routes.js';
import { certificateTemplateAdminRouter } from './certificate-template.routes.js';
import { auditAdminRouter } from './audit.routes.js';
import { revenueAdminRouter } from './revenue.routes.js';
import { instructorsAdminRouter } from './instructors.routes.js';
import { supportAdminRouter } from './support.routes.js';
import { paymentReviewAdminRouter } from './payment-review.routes.js';
import { settingsAdminRouter } from './settings.routes.js';
import { partnersAdminRouter } from './partners.routes.js';
import crypto from 'node:crypto';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

// Public image upload for covers, banners, logos, signatures -> { url }
adminRouter.post(
  '/uploads',
  h(async (req, res) => {
    const input = body(req, z.object({ file: fileInput, kind: z.enum(['cover', 'banner', 'logo', 'signature', 'avatar', 'other']).default('other') }));
    const img = decodeImage(input.file);
    const url = await storage.putPublic(`${input.kind}/${crypto.randomUUID()}.${img.ext}`, img.buffer, img.mime);
    await writeAudit(req.user!.id, 'upload.create', 'Upload', null, { kind: input.kind, url });
    res.status(201).json({ url, width: img.width, height: img.height });
  }),
);

adminRouter.use(
  dashboardRouter,
  coursesAdminRouter,
  lessonsAdminRouter,
  quizAdminRouter,
  gradingAdminRouter,
  landingAdminRouter,
  taxonomyAdminRouter,
  usersAdminRouter,
  certificateTemplateAdminRouter,
  auditAdminRouter,
  revenueAdminRouter,
  instructorsAdminRouter,
  supportAdminRouter,
  paymentReviewAdminRouter,
  settingsAdminRouter,
  partnersAdminRouter,
);
