# Online Training — project skeleton

Monorepo skeleton for the Online Training course site (USER + ADMIN).
Full spec: [docs/SPEC.md](docs/SPEC.md). Read it before writing code.

Every file is a stub: a header comment says what it is for, `TODO:` lines say what to build.
Config and wiring (package.json, tsconfig, Vite, Vuetify theme, routers, Express app order) are real and ready.

```
.
├── docs/SPEC.md            spec (source of truth)
├── api/                    Node + Express + TS + Prisma + Zod  -> Railway
└── web/                    Vue 3 + Vite + TS + Vuetify + Pinia -> Vercel
```

## api/

```
api/
├── prisma/
│   ├── schema.prisma       [STARTER] replace with the starter's schema
│   └── seed.ts             demo data (build step 8)
├── src/
│   ├── index.ts            server entry
│   ├── app.ts              middleware order: CORS -> Stripe raw webhook -> json -> routes -> /admin -> errors
│   ├── config.ts db.ts mail.ts          [STARTER]
│   ├── middleware/
│   │   ├── auth.ts         [STARTER] cookie JWT, BANNED check, requireAuth / requireAdmin
│   │   └── error-handler.ts  stable error codes -> JSON
│   ├── lib/                errors (codes), validate (Zod), audit, notify, pagination, slug, money
│   ├── providers/
│   │   ├── video/          VideoProvider interface + BunnyStreamProvider
│   │   └── storage/        FileStorage interface + BunnyStorage (or R2)
│   └── modules/            one folder per feature: *.routes.ts + *.service.ts + *.schemas.ts
│       ├── auth/           [STARTER] register, verify, login, Google, forgot/reset, me, logout
│       ├── catalog/        courses list/detail, categories, tags
│       ├── landing/        GET /landing
│       ├── learning/       enroll, My learning, continue, player URL, progress, lock order
│       ├── quiz/           attempts, timer, grading, cycle reset, answer-hiding serializer
│       ├── payments/       Stripe checkout, webhook (idempotent), orders
│       ├── certificates/   issue, public verify, PDF (pdf-lib)
│       ├── notifications/  in-app bell
│       └── admin/          everything under /admin (requireAdmin + audit log)
│           dashboard, courses, lessons, quiz, grading, landing,
│           taxonomy, users, certificate-template, audit
└── tests/                  vitest it.todo() for the tricky rules (spec section 14)
```

### Starter files
`api/` already has a starter (spec section 12) that is **not in this folder yet**. Files marked `[STARTER]` are placeholders:
copy the starter's real files over them. If the starter uses other paths or names, keep the starter's and fix the imports in `app.ts`
and `modules/admin/index.ts`. Keep the starter's `package.json` too and add only the missing dependencies from this one.

## web/

```
web/src/
├── main.ts  App.vue        App picks PublicLayout or AdminLayout from route.meta.layout
├── plugins/vuetify.ts      custom dark theme "otDark" (spec section 8 colors)
├── styles/main.css         Inter, radius tokens, visible focus
├── router/
│   ├── user.routes.ts      /, /login, /register, /verify-email, ..., /courses/:slug, /learn/:slug(/quiz|/result), /profile, /certificates/:number
│   ├── admin.routes.ts     /admin/* (meta.admin)
│   └── guards.ts           login redirect + ADMIN check (UI only; API enforces)
├── api/                    one file per API area (+ api/admin/*), client.ts = fetch with cookies + ApiError(code)
├── stores/                 auth, notifications (Pinia)
├── composables/            useProgressReporter (10s), useQuizTimer, useOrderPolling, useHls
├── layouts/                PublicLayout, AdminLayout
├── components/
│   ├── common/             header, footer, bell, status pill, empty state, confirm dialog, Google button
│   ├── course/             banners, continue row, filters, card, grid, purchase card, outline, outcomes
│   ├── learn/              video player, lesson sidebar
│   ├── quiz/               timer, navigator, MCQ, essay, answer review
│   ├── profile/            My learning list, notification list
│   ├── certificate/        CertificateView (shared by public page + admin preview)
│   └── admin/              sidebar, page header, image/video upload,
│                           course-editor/ (4 tabs + QuestionEditor), grading/, landing/
├── pages/
│   ├── user/               Home, auth/, course/, learn/ (Learn, Quiz, Result), profile/ (Profile, Orders)
│   ├── public/             CertificatePage (verify)
│   ├── errors/             404, 403, CourseUnavailable, Locked
│   └── admin/              Dashboard, courses/ (List, Editor), grading/ (Queue, Attempt),
│                           LandingEditor, Taxonomy, Users, CertificateTemplate, AuditLog
└── types/                  shared API types
```

## Change request 2026-11-17 (spec section 15)

Three areas now: **user**, **instructor** (`/instructor`, new), **admin**.

| Feature | api | web |
|---|---|---|
| Revenue share ledger, CSV, payouts | `modules/revenue/`, `admin/revenue*.routes.ts` | `pages/admin/RevenuePage.vue`, `components/admin/revenue/` |
| Instructor role (max 2 per course) | `modules/instructor/`, `middleware/roles.ts`, `admin/instructors.routes.ts` | `pages/instructor/`, `layouts/InstructorLayout.vue`, `router/instructor.routes.ts`, editor tab `InstructorsTab.vue` |
| Pinned courses (admin-only, 2026-11-22) | `modules/admin/courses.routes.ts` (`Course.pinOrder`) | `pages/admin/courses/CourseListPage.vue` |
| Private chat (Support / course) + images | `modules/chat/`, `lib/attachments.ts`, `admin/support.routes.ts` | `pages/user/messages/`, `components/chat/`, `pages/admin/SupportInboxPage.vue` |
| Video 720p / 1080p / 4K | `BunnyStreamProvider.ts` (TODO) | `learn/QualityMenu.vue` |
| THB price, PromptPay, bank slip, Bitcoin | `lib/order-paid.ts`, `payments/bank-transfer.routes.ts`, `payments/crypto-webhook.routes.ts`, `providers/payments/`, `admin/payment-review.routes.ts` | `PaymentMethodPicker.vue`, `BankTransferPanel.vue`, `pages/user/checkout/BankTransferPage.vue`, `pages/admin/PaymentReviewPage.vue` |

Every way an order becomes PAID goes through `api/src/lib/order-paid.ts` (enrollment + ledger, exactly once).
New open decisions: Bitcoin provider, 4K cost, who counts as a partner, bank details (spec 10.6–10.9).

## Getting started (local)

Needs Node 20+ and Docker.

```bash
docker run -d --name ot-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=online_training -p 5432:5432 postgres:16
```

```bash
cd api && npm install && npx prisma migrate deploy && npx prisma db seed && npm run dev
```

```bash
cd web && npm install && npm run dev
```

Open http://localhost:5173. API runs on http://localhost:4000.
Demo logins (admin, learner, instructor, partner) and their password are listed at the top of `api/prisma/seed.ts`.

Without real keys the app runs in dev mode:
- **Payments:** `DEV_FAKE_PAYMENTS=true` marks card/PromptPay orders paid at once (never in production). Bank transfer works fully (slip upload + admin review).
- **Video:** the dev provider plays a public HLS test stream; uploads are accepted and discarded.
- **Email:** printed to the API console (verification and reset links are there).
- **Files:** stored under `api/uploads/`.

Tests: `cd api && npm test` (needs the Postgres container; uses a separate `online_training_test` database).

## Before going live
- Real keys in `api/.env`: Stripe (+ webhook secret), Bunny Stream/Storage, Resend, Google client id; `JWT_SECRET`; `WEB_URL`/`API_URL`.
- Admin → Settings: real bank account. Admin → Certificate: issuer and signer.
- Open decisions for the client: Bitcoin provider, 4K (per-course `allow4k` switch exists), whether instructors still get a revenue share, Bunny confirmation. Refunds are not handled in the system (2026-11-22).

## Notes
- Stripe returns to `/profile/orders?session_id=...` (shows "Confirming payment"); `/checkout/return` forwards there.
- Schema change beyond the client's file: `Course.allow4k` (migration `20261118034943_course_allow4k`).
