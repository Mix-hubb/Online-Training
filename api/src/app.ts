// Express app wiring. Order matters:
//  1. trust proxy (Railway), security headers (helmet), gzip, CORS with credentials, cookie-parser
//  2. Stripe + crypto webhooks with express.raw()  <-- MUST be before express.json()
//  3. express.json(): 25 MB only on the routes that take images as base64, 1 MB everywhere else
//  4. public + user routes, /instructor (requireInstructor + assignment), /admin (requireAuth + requireAdmin)
//  5. 404 + error handler (stable error codes)
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { errorHandler, notFound } from './middleware/error-handler.js';
import { sameOrigin, throttle } from './middleware/guards.js';
import { stripeWebhookRouter } from './modules/payments/webhook.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { landingRouter } from './modules/landing/landing.routes.js';
import { learningRouter } from './modules/learning/learning.routes.js';
import { quizRouter } from './modules/quiz/quiz.routes.js';
import { checkoutRouter } from './modules/payments/checkout.routes.js';
import { certificatesRouter } from './modules/certificates/certificates.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { adminRouter } from './modules/admin/index.js';
import { cryptoWebhookRouter } from './modules/payments/crypto-webhook.routes.js';
import { bankTransferRouter } from './modules/payments/bank-transfer.routes.js';
import { chatRouter } from './modules/chat/chat.routes.js';
import { instructorRouter } from './modules/instructor/index.js';
import { partnerRouter } from './modules/partner/partner.routes.js';
import { filesRouter } from './modules/files/files.routes.js';
import { reviewsRouter } from './modules/reviews/reviews.routes.js';
import { bunnyWebhookRouter } from './modules/video/bunny-webhook.routes.js';
import { config } from './config.js';

/** Routes whose JSON body carries base64 images (see lib/attachments.ts). */
export const UPLOAD_ROUTES = /^\/(admin\/uploads|admin\/partners\/[^/]+\/logo|orders\/[^/]+\/slip|me\/threads\/support|courses\/[^/]+\/threads|threads\/[^/]+\/messages)$/;

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  // JSON API: no CSP needed; public images under /files are shown on the web origin, so allow cross-origin reads.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(cors({ origin: config.WEB_URL, credentials: true }));
  app.use(cookieParser());
  app.use(sameOrigin); // CSRF: state-changing requests must come from the web app (webhooks skipped)
  app.use(throttle);   // per-user limits on chat sends, checkouts / slips, admin uploads

  // Raw body for Stripe signature verification.
  app.use('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookRouter);
  app.use('/crypto/webhook', express.raw({ type: '*/*' }), cryptoWebhookRouter);

  // Dev video provider: accept and discard the upload body (Bunny uses TUS on its own host).
  if (!config.bunnyStreamEnabled) {
    app.put('/dev/video-upload/:id', (req, res) => {
      req.resume();
      req.on('end', () => res.status(204).end());
    });
  }

  // Image uploads arrive as base64 JSON (chat: 3 images x 5 MB). Only these routes get the big limit.
  const bigJson = express.json({ limit: '25mb' });
  const smallJson = express.json({ limit: '1mb' });
  app.use((req, res, next) => (UPLOAD_ROUTES.test(req.path) ? bigJson : smallJson)(req, res, next));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use(filesRouter);          // /files/public/* (local disk), /files/private/* (signed; local disk or Bunny private zone)
  app.use(bunnyWebhookRouter);   // /bunny/webhook (Bunny Stream: video encoded / failed)
  app.use('/auth', authRouter);
  app.use(catalogRouter);        // /courses, /categories, /tags
  app.use(landingRouter);        // /landing
  app.use(learningRouter);       // /courses/:id/enroll, /me/courses, /me/continue, /lessons/...
  app.use(quizRouter);           // /courses/:id/quiz/start, /attempts/...
  app.use(checkoutRouter);       // /courses/:id/checkout, /orders...
  app.use(certificatesRouter);   // /certificates/:number, /me/certificates/:id/pdf
  app.use(notificationsRouter);  // /notifications
  app.use(bankTransferRouter);   // /payments/bank-details, /courses/:id/checkout/bank-transfer, /orders/:id/slip
  app.use(chatRouter);           // /me/threads, /threads/..., /attachments/:id/url
  app.use(reviewsRouter);        // /courses/:slug/reviews, /me/courses/:courseId/review
  app.use('/instructor', instructorRouter);
  app.use(partnerRouter);          // /partner/* (requireAuth + requirePartner)
  app.use('/admin', adminRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
