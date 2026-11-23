# Online Training: project spec (hand-off for Claude Code)

> **Client change request 2026-11-17 applies.** Section 15 overrides anything above it that disagrees
> (roles, payments, video quality, chat, pinned courses, revenue share). Section 16 (2026-11-22) overrides parts of 15.

Read this file fully before writing code. Work in the order of "Build order" at the bottom. When something is unclear, check "Open decisions" first, then ask instead of guessing.

## 1. What we are building

A course-learning website (similar to Born to Dev) with two roles: **USER** and **ADMIN**.
- Topic of the first courses: operating and repairing crypto-mining hardware (Bitmain Antminer, MicroBT Whatsminer, Canaan Avalon: hashboards, ASIC chips, power supplies, control boards, fans).
- All course content and the whole UI are in **English**.
- Site name: **Online Training**. Company shown in the footer: **Hidden Mines Co., Ltd.** (address, phone, email, website are admin-editable; use bracketed placeholders until real values exist).
- Courses are **free** or **paid once** (no subscription). A bought course is owned for good. Currency **USD**. Payment by **Stripe Checkout**: card, and PromptPay if possible (see Open decisions).
- Video is delivered by a **streaming server + CDN** (HLS), required by the company. Provider is not final (see Open decisions); default is Bunny Stream behind an interface.
- Time budget: about 15 days, one developer using Claude Code. Keep things simple and ship the core first.

## 2. Stack and hosting

| Part | Choice |
|---|---|
| Frontend | Vue 3 + Vite + TypeScript + Vuetify + Pinia + vue-router. Deploy on **Vercel** |
| Backend | Node + Express + TypeScript + Prisma + Zod. Deploy on **Railway** |
| DB | PostgreSQL (Railway) |
| Auth | Email + password (bcrypt) with JWT in an httpOnly cookie; Google sign-in (ID token); email verification; password reset. Cross-site cookies in production: `SameSite=None; Secure`, CORS with credentials, `trust proxy` |
| Email | Resend (log to console in dev when no key) |
| Video | Bunny Stream (HLS, CDN, signed/token URLs) behind a `VideoProvider` interface |
| Files (cover, banner, logo, signature) | Bunny Storage or Cloudflare R2 behind a `FileStorage` interface |
| Payments | Stripe Checkout + webhook |
| PDF | `pdf-lib` for certificates |

Monorepo: `web/` and `api/`. A starter already exists for `api/` (see section 12).

## 3. Roles and main flows

**User:** open site, sign up or log in (email/password or Google; email must be verified before login), browse and search courses (filters), open a course page (intro video, outcomes, lesson list, price), buy (paid) or start (free), watch lessons in order, take the final test, get a certificate (or wait for instructor grading), see history on the profile page.

**Admin:** manage courses (create, edit, delete, draft/publish/archive), lessons and video uploads, final test (settings and questions), grade written answers, manage landing page banners and text, categories and tags, users (view, ban/unban), certificate template, audit log, dashboard. Admin can preview a course as a user before publishing.

## 4. Business rules (must hold on the server, not only in the UI)

**Access**
- Free course: any logged-in user can enroll. Paid course: enrollment is created only after Stripe confirms payment.
- Course status: `DRAFT` (admin only), `PUBLISHED` (public), `ARCHIVED` (hidden from catalog, cannot be bought, existing owners keep full access).
- Banned user (`User.status = BANNED`): rejected on every request, even with a valid token.
- Video URLs are signed and short-lived, issued only to users who own the course (or admins). Never expose raw video IDs or permanent URLs to others.

**Lessons and progress**
- Lessons are watched **in order**. Lesson N+1 unlocks when lesson N is completed.
- A lesson is **completed** when watched time is at least **90%** of its duration.
- The player sends progress about every 10 seconds: `{ position, watchedDelta }`. The server must not trust the client blindly: cap each `watchedDelta` by real elapsed time since the previous update (plus a small tolerance) so skipping cannot be counted as watching.
- **Resume:** store `lastPositionSec` per lesson and `lastLessonId` per enrollment. Opening a lesson continues from the saved position. "My learning" and the home page have a "Resume" button that goes to the last lesson.
- The final test unlocks only when **all lessons** are completed.

**Final test (one per course, configured by admin)**
- Settings: `passPercent`, `timeLimitMin` (nullable = no limit), `maxAttempts`.
- Question types: **MCQ** (auto-graded, single correct option) and **ESSAY** (typed in the web page, graded by an admin).
- The time limit is enforced on the server (`startedAt` + limit). Late submissions are rejected or auto-submitted.
- If the attempt has no essay answers: grade immediately. Pass means `score / maxScore >= passPercent`. Passing issues the certificate immediately.
- If it has essay answers: status `PENDING_REVIEW`, the learner sees "waiting for instructor". The admin enters points per essay question (and an optional comment), the system adds MCQ + essay points, sets `passed`, issues the certificate if passed, and sends an **in-app notification**.
- **Answer review rule:** correct answers, per-question right/wrong, and instructor comments are visible **only after the learner has passed**. Before that, the API returns only score, pass/fail, and attempts left. Do not leak `isCorrect` in any response for an unpassed learner.
- **Failing all attempts:** after the last allowed attempt is graded and not passed, run a reset: `Enrollment.cycle += 1`, lesson progress for the new cycle starts empty, status back to `IN_PROGRESS`, in-app notification. Keep old attempts for history. The learner does **not** buy again. A new cycle gets a fresh set of attempts (attempts are counted per cycle). A `PENDING_REVIEW` attempt counts as used, but the reset only runs after grading.

**Certificate**
- One per enrollment, issued on pass. Public number like `OT-2026-000123` (unique). Public verify page `/certificates/:number` (shows name, course, date, valid).
- PDF layout is fixed (A4 landscape). Admin edits only: heading text, issuer name, signer name and title, logo, signature image, accent color (`CertificateTemplate` singleton row).

**Payments**
- Checkout creates an `Order` (`PENDING`) and a Stripe Checkout Session. The webhook (`checkout.session.completed`) marks the order `PAID`, stores `receiptUrl` and payment intent, and creates the `Enrollment`. The webhook must be **idempotent** (unique `stripeSessionId`; ignore repeats) and uses the raw body for signature verification (mount before `express.json()`).
- After redirect back, the page shows "Confirming your payment…" and polls the order until `PAID`.
- ~~`charge.refunded`~~ **Changed 2026-11-22 (see 16.1):** no refunds in the system; Stripe refund events are ignored.
- Receipts are Stripe receipts only. Thai tax invoices are **out of scope for v1**.

**Notifications:** in-app only (bell with unread count, list on the profile page). Created on: written answers graded, certificate ready, payment received, lessons reset after failing all attempts.

**Audit log:** write an `AuditLog` row for every admin mutation (course, lesson, quiz, grade, user ban, banner, landing, category/tag, certificate template). Read-only list for admins.

## 5. Pages and routes

Public layout has Header (logo, Courses, My learning, bell, avatar; logged-out shows Log in and Sign up) and Footer (brand, links, company contact).

**User**
- `/` Home: banner slider (admin-managed), "Continue learning" row (logged in), search, filters (category, level, free/paid, topic tags), course grid, pagination.
- `/login`, `/register` (tabs on one page), `/verify-email?token=`, `/forgot-password`, `/reset-password?token=`
- `/courses/:slug` Course page: intro video, outcomes, lesson list, final test info, purchase card with 3 states (not bought: Buy; bought: Go to course; free: Start free).
- `/learn/:slug` Player: video, resume, "watch 90%" hint, locked lesson sidebar, final test row (locked until all lessons done).
- `/learn/:slug/quiz` Test: sticky timer, attempt counter, question navigator, MCQ and essay.
- `/learn/:slug/result` Result with 4 states: passed (review answers + certificate), failed with attempts left, waiting for instructor, no attempts left (reset notice).
- `/profile` Profile + My learning (filter All / In progress / Completed; statuses: In progress, Ready for final test, Waiting for instructor, Lessons restarted, Completed) + notifications.
- `/profile/orders` Orders and receipts.
- `/certificates/:number` Certificate view and public verification.
- Error/empty states: 404, 403, course unavailable, locked (buy to open).

**Admin (`/admin`, role ADMIN only)**
- `/admin` Dashboard (published courses, learners, sales this month, grading queue count, recent orders)
- `/admin/courses` list (search, status and category filter, Edit, Preview, Delete) and `/admin/courses/new`, `/admin/courses/:id` editor with 4 tabs: **Details** (title, summary, description, category, level, tags, outcomes, price/free, cover image, intro video), **Lessons** (sortable list, upload, video status Processing/Ready/Failed), **Final test** (settings + question editor), **Learners** (progress, test status, round)
- `/admin/grading` queue + grading screen
- `/admin/landing` banners (add, replace, delete, reorder, show/hide), home text, section visibility, footer/company info
- `/admin/taxonomy` categories and tags CRUD
- `/admin/users` list, ban/unban (no role change in v1; learners and admins only, see 18)
- `/admin/certificate` template editor with live preview
- `/admin/audit` audit log with filters

## 6. Data model

Full Prisma schema: `api/prisma/schema.prisma` (already written). Main models: `User`, `AuthToken`, `Category`, `Tag`, `CourseTag`, `Course`, `Lesson`, `Enrollment` (with `cycle`, `lastLessonId`), `LessonProgress` (per cycle, `watchedSec`, `lastPositionSec`, `completed`), `Quiz`, `Question`, `Option`, `QuizAttempt` (per cycle), `AttemptAnswer`, `Certificate`, `CertificateTemplate`, `Order`, `Notification`, `Banner`, `LandingSection`, `AuditLog`. Money is stored as integer minor units plus a currency code.

## 7. API outline (REST, JSON, cookie auth)

- Auth: `POST /auth/register|login|logout|google|verify-email|forgot-password|reset-password`, `GET /auth/me`
- Catalog: `GET /courses?q&category&level&price&tag&page`, `GET /courses/:slug`, `GET /categories`, `GET /tags`, `GET /landing` (banners, texts, footer)
- Learning: `POST /courses/:id/enroll` (free only), `GET /me/courses`, `GET /me/continue`, `GET /courses/:slug/learn` (lessons + progress + lock state), `GET /lessons/:id/play` (signed video URL), `PUT /lessons/:id/progress`
- Test: `POST /courses/:id/quiz/start`, `PUT /attempts/:id/answers`, `POST /attempts/:id/submit`, `GET /attempts/:id` (review fields only if passed)
- Payments: `POST /courses/:id/checkout`, `POST /stripe/webhook`, `GET /orders`, `GET /orders/by-session/:sessionId`
- Certificates: `GET /certificates/:number` (public), `GET /me/certificates/:id/pdf`
- Notifications: `GET /notifications`, `POST /notifications/:id/read`
- Admin (all require ADMIN, all write audit logs): CRUD for courses, lessons (+ upload init and video status), quiz settings and questions, `GET/POST /admin/grading...`, `GET /admin/courses/:id/learners`, banners, landing sections, categories, tags, users (+ ban/unban), certificate template, `GET /admin/audit`, `GET /admin/dashboard`

Validate all input with Zod. Return stable error codes (`UNAUTHENTICATED`, `FORBIDDEN`, `BANNED`, `NOT_ENROLLED`, `LOCKED`, `NO_ATTEMPTS_LEFT`, ...).

## 8. Design

Interactive mockup (19 screens, user + admin, with state variants): https://claude.ai/artifact/B3JnXTUNdy6Ka6xFmwztN4 . Match it. Prices, counts, names in it are sample data.

Dark theme, calm and professional (set up as a custom Vuetify dark theme):
- Background `#0D1117`, surface `#131922`, raised `#19212C`, border `#232D3A` (inputs `#2D3947`), footer/sidebar `#0A0D12`
- Text `#E7ECF2`, muted `#93A0B0`
- Accent steel blue `#5B9BD0` (button text `#07131D`), accent tint `#1B2A38` with text `#8DBDE6`
- Status (muted): success `#6FC3A5`, warning `#D4A85A`, danger `#D97B7B`
- Font Inter. Radius: cards 14px, buttons/inputs 10px, pills 6px. Touch targets at least 44px. No emoji, no loud gradients. Use real `<button>`/`<a>`, labels on inputs, keyboard focus visible.
- Certificate is the exception: warm off-white `#F6F4EE`, serif heading (Fraunces), A4 landscape.
- Footer text: "© 2026 Hidden Mines Co., Ltd. All rights reserved."

## 9. Environment variables

`api/.env.example` already lists them: `DATABASE_URL`, `JWT_SECRET`, `WEB_URL`, `COOKIE_DOMAIN`, `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `MAIL_FROM`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY`, `BUNNY_CDN_HOSTNAME`. Web needs `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`. Never commit secrets.

## 10. Open decisions (ask the owner, do not guess)

1. **Video provider:** not final. Build against a `VideoProvider` interface (create video, upload URL/status, signed playback URL). Default implementation: Bunny Stream. The company said "streaming server + CDN" is required; confirm the provider before wiring production.
2. ~~PromptPay~~ **Decided 2026-11-17:** each course has a separate THB price; PromptPay is offered for THB through Stripe (see 15.6). Still needs a Stripe account that supports PromptPay.
3. ~~Refund behavior~~ **Decided 2026-11-22:** no refund feature. The customer handles refunds with the payment gateway directly (see 16.1).
4. **Who uploads videos:** the admin page uploads to the provider (default), or admins paste a video ID after uploading elsewhere.
5. **Thai tax invoice:** out of scope; ask later if the company needs it.
6. **Bitcoin provider:** "a separate provider" — which one is not named. Build behind a `CryptoPaymentProvider` interface; confirm the provider before wiring.
7. **4K cost:** 4K adds storage and streaming cost. Check the video provider's prices before enabling 4K for every course (default: 4K off per course, admin turns it on).
8. ~~Who is a revenue-share partner~~ **Decided 2026-11-18:** co-investors (no account, logo on home page + footer) and instructors (linked account, see own earnings). Both use the same ledger.
9. **Bank-transfer details:** account name/number shown to learners must come from the owner. Use [BANK NAME] / [ACCOUNT NAME] / [ACCOUNT NUMBER] placeholders until then.

## 11. Out of scope for v1 (do not build)

Subscriptions, coupons, ~~reviews and ratings~~ (now in scope, see 17), public Q&A under lessons (private course chat is in scope, see 15.4), wishlist, manual course grant, certificate revocation, changing roles other than assigning instructors to courses, email notifications (in-app only), multi-language UI, drag-and-drop certificate designer, DRM, automatic payouts to partners (payouts are recorded by hand, see 15.1).

## 12. Existing starter

`api/` (Express + Prisma) is already scaffolded: full `schema.prisma`, `config.ts`, `db.ts`, `mail.ts`, auth middleware (cookie JWT, re-checks banned status), auth routes (register, verify, login, Google, forgot/reset, me, logout). It was **not yet run against a real database**: run `npm install && npx prisma migrate dev --name init` first and fix anything that fails. `web/` does not exist yet.

## 13. Build order (15 days)

1. Repo setup, run the api starter, deploy skeletons to Railway and Vercel, Vuetify dark theme, layout (Header/Footer/Admin sidebar), auth pages wired to the API.
2. Catalog: categories/tags, course list with search and filters, course page, admin course CRUD (details tab), draft/publish/archive.
3. Lessons: admin lesson CRUD and video upload with status, player with signed URLs, progress with anti-skip cap, lesson locking, resume.
4. Payments: Stripe Checkout, webhook (idempotent), orders page, enrollment on payment.
5. Final test: admin quiz editor, user test flow with timer, auto-grading, result states, answer-hiding rule, attempts and cycle reset.
6. Grading screen, in-app notifications, certificate PDF + public verify, profile "My learning" statuses.
7. Landing/banner CMS, users + ban, audit log, dashboard, certificate template editor.
8. QA of the whole path (sign up, buy, learn, test, certificate), fix bugs, seed demo data.

If time runs short, cut in this order: certificate template editor, audit log, landing section visibility (keep banners), dashboard stats, detailed users page. Never cut: auth, courses and lessons, player and progress, Stripe, test and grading, certificate, admin course CRUD.

## 14. Working rules for Claude Code

- Enforce every business rule in section 4 on the server and cover the tricky ones with tests (progress cap, 90% rule, lock order, answer hiding, attempts and cycle reset, webhook idempotency, banned user).
- Keep it simple: no extra libraries or abstractions beyond this spec. Small commits per feature.
- Do not invent real company data (address, phone, email, signer); keep placeholders in brackets.
- After each milestone, run the app and test the real flow before saying it is done.

## 15. Client change request (2026-11-17) — overrides earlier sections

**First step for Claude Code:** in `api/` run `npm install && npx prisma validate && npx prisma migrate dev --name init`.
Status 2026-11-18: `prisma validate` passes and `prisma migrate diff` builds the init SQL (32 tables). `migrate dev` still needs a running PostgreSQL.

**Schema names (source of truth: `api/prisma/schema.prisma`):** `CourseInstructor`, `LessonRendition` (+ `Lesson.sourceHeight`), `Partner` (`sharePercentBp`, see 16.2), `RevenueEntry` (`percentBp` snapshot, `status` UNPAID/PAID), `Course.pinOrder` (see 16.4), `PartnerPayout`, `PaymentSlip`, `SupportThread` (`type` SUPPORT/COURSE), `ThreadMessage`, `MessageAttachment`, `Order.provider` STRIPE/BANK_TRANSFER/CRYPTO, `Order.status` += AWAITING_SLIP, `Course.priceThbMinor`.

### 15.1 Revenue share (ledger inside the system)
- **Changed 2026-11-22 (see 16.2):** each partner has ONE share of total revenue (`Partner.sharePercentBp`); there are no per-course shares. A `Partner` is its own record. Two kinds:
  - **Co-investor:** a company that invests with us. Gets a login with role **`PARTNER`** (see 15.9). Has a logo (`logoUrl`, `websiteUrl`) shown in the partner strip on the **home page and footer** when `showLogo` is on (order by `logoOrder`). The admin manages them at `/admin/partners` and records payouts by hand.
  - **Instructor:** also gets a share. Linked to their user account (`Partner.userId`, role INSTRUCTOR) so they can see their own earnings in `/instructor/earnings`.
- When an order becomes PAID, write one `RevenueEntry` per partner with a share: amount = order amount × the partner's percent, **store the percent used at that moment** (later percent changes never rewrite old entries), currency = order currency.
- Never edit or delete ledger rows. (No refund reversals: see 16.1.)
- Admin: revenue report (filters: date range, course, partner, currency), **CSV export**, outstanding balance per partner (sum of unpaid entries), and a **"Mark as paid"** action that creates a `Payout` (partner, amount, currency, paidAt, note, admin) and links the covered entries.
- The system does **not** transfer money. Mark as paid only records a payout done outside the system. Audit-log every payout.
- Amounts in USD and THB are never summed together; report per currency.

### 15.2 Instructor role
- New role `INSTRUCTOR`. The admin assigns instructors to a course (`CourseInstructor`), **max 2 per course** (enforce on the server).
- An instructor, only for courses they are assigned to: sees learners and their progress, grades essay answers, answers course chat, sees **their own** earnings (ledger + payouts where they are the partner).
- An instructor **cannot** edit course content (details, lessons, test, price, status) and has no access to other admin pages.
- Instructor area: `/instructor` (own layout). API under `/instructor/*`, every route checks the assignment.
- The essay grading queue for admins still shows everything; instructors see only their courses.

### 15.3 Pinned courses
- ~~Learner pins (max 6, `PIN_LIMIT`)~~ **Replaced 2026-11-22 by admin-only pinning, see 16.4.**

### 15.4 Chat (private)
- Two kinds of threads, both private between one learner and staff:
  - **Support**: learner ↔ admins.
  - **Course question**: learner ↔ the course's instructors (only for enrolled learners; admins can read too).
- Up to **3 images per message**, each **≤ 5 MB** (validate type and size on the server). Images are stored privately and opened only through **short-lived signed links**.
- Unread counts for both sides; new message creates an in-app notification.
- Routes: user `/messages` (list + thread), instructor `/instructor/messages`, admin `/admin/support`.

### 15.5 Video quality
- Encode **720p / 1080p / 4K**, but never upscale beyond the source resolution (a 1080p upload gets 720p + 1080p only).
- The player offers **Auto** (adaptive) or a manual quality choice.
- 4K adds storage and streaming cost: keep a per-course "Allow 4K" switch, default off, and check provider prices first (open decision 10.7).

### 15.6 Payments
- **Card and PromptPay through Stripe.** Each course has a USD price and a separate **THB price** (both stored as minor units). PromptPay is only offered with THB.
- **Bank transfer:** the learner sees the bank details ([placeholders] until provided), uploads a payment slip; the order is `AWAITING_SLIP`; an admin approves (→ PAID, enrollment, ledger) or rejects (with reason, notification). Slip images use the same private storage + signed links as chat.
- **Bitcoin:** through a separate provider behind `CryptoPaymentProvider` (open decision 10.6); its webhook marks the order PAID, idempotent like Stripe.
- Every path to PAID must go through one `markOrderPaid()` that creates the enrollment and the ledger entries exactly once.

### 15.7 New error codes
`INSTRUCTOR_LIMIT`, `NOT_ASSIGNED`, `ATTACHMENT_TOO_LARGE`, `TOO_MANY_ATTACHMENTS`, `UNSUPPORTED_FILE_TYPE`, `PAYMENT_METHOD_UNAVAILABLE`, `SLIP_ALREADY_REVIEWED`.

### 15.8 New tests (add to section 14)
Ledger percent snapshot, payout covers only unpaid entries, max 2 instructors, instructor scope (cannot edit details or lessons, cannot see other courses), chat privacy (learner sees only own threads), attachment limits, no video upscaling, PromptPay only with THB, slip approve/reject runs once, `markOrderPaid` idempotent across Stripe/slip/Bitcoin.

### 15.9 Partner role and portal (2026-11-18)
- New role **`PARTNER`** (schema: `Role.PARTNER`, `User.mustChangePassword`). Linked to its `Partner` record by `Partner.userId`.
- **Accounts are created by an admin** on `/admin/partners` ("Create login"): email is the username, the system makes a random temporary password and shows it **once**; the admin sends email + password to the partner. No signup, no email verification for these accounts (`emailVerifiedAt` set on creation).
- On first login the partner **must change the password** (`/account/change-password`); every other API call returns `MUST_CHANGE_PASSWORD` until then. **Forgot password, two ways (email first):**
  1. **Self-service (default):** the partner clicks "Forgot password?" on the normal log-in page and gets the usual reset email (`/forgot-password` -> `/reset-password?token=`). Works for every role, PARTNER included. The password they set is their own, so `mustChangePassword` stays false.
  2. **Admin fallback:** only if the email way does not work (no email received, wrong or lost mailbox), the admin clicks "Reset password" on `/admin/partners`: new temporary password shown once, `mustChangePassword = true`, admin sends it to the partner.
  The partner's real email must be entered when the account is created, or way 1 cannot work.
  Turning a login off uses the normal ban.
- Partner portal `/partner` (own layout): **`/partner/revenue-sharing`** (summary per currency: earned, paid, outstanding; filters; table of own `RevenueEntry` rows with the share % snapshot; CSV export) and `/partner/payouts`.
- A partner sees **only its own** data and **never** buyer names or emails. It cannot open admin, instructor or learning pages.
- Instructors with a share (Partner linked to an INSTRUCTOR account) see the same data in `/instructor/earnings`.
- Tests: own data only, no buyer identity, forced password change, email reset works for PARTNER and does not set mustChangePassword, temporary password stored only as a hash, banned partner rejected.

## 16. Client change request (2026-11-22) — overrides earlier sections

### 16.1 No refunds
- There is no refund feature. Refunds are handled by the customer directly with the payment gateway, outside the system.
- No `REFUNDED` order status, no refund endpoints, no negative reversal ledger entries. Stripe refund events (`charge.refunded`, ...) are ignored.

### 16.2 Revenue share per partner, not per course
- A partner is added once with ONE share of TOTAL revenue (all courses): `Partner.sharePercentBp` (basis points, 2500 = 25%). The sum over all partners must be <= 10000 (enforced on the server, under a lock). There is no inactive state: set a partner to 0% to stop its share.
- `markOrderPaid()` writes one `RevenueEntry` per partner with a share > 0, snapshotting the percent on the entry. Changing a partner's percent later never changes existing entries. Entries are never edited or deleted.
- Report filters (date range, course, partner, currency), CSV export, "Mark as paid" and per-currency reporting are unchanged.
- Period picker (2026-11-23), admin and partner "Revenue sharing" pages: **Month** (default: this month, previous/next) or **Specific days** (from/to, one day allowed). The period scopes totals, chart, entries and CSV; days are the viewer's local calendar days.
- Chart: share per day (per month when the period is over 62 days), one currency at a time (USD and THB never added), hover or arrow keys for values, and a table view.
- Admin UI: the percentage is set on `/admin/partners` (create/edit). The course editor has no revenue-share tab.
- ~~Open question: whether instructors still get a revenue share.~~ **Decided 2026-11-22:** yes, per assigned course:
  - `CourseInstructor.sharePercentBp` = the instructor's share of THAT course's sales, set by the admin in the course editor's Instructors tab (`POST|PATCH /admin/courses/:id/instructors[/:userId]`). The instructors of one course together <= 100%.
  - Order of the split: instructor entries first (`kind = INSTRUCTOR`, base = order amount), then co-investor entries (`kind = PARTNER`) on what is left. Example: $100 sale, instructor 30%, co-investor 25% -> instructor $30, co-investor 25% of $70 = $17.50.
  - A Partner linked to an INSTRUCTOR account never has a total share (`Partner.sharePercentBp` stays 0); its Partner row is created on demand to hold the entries and payouts.
  - Percent and base are snapshotted on each entry, like the co-investor share. Instructor earnings page lists the current share per course.

### 16.3 Instructors manage the final test
- An instructor assigned to a course (`CourseInstructor`) can set pass %, time limit and attempts, and create/edit/delete/reorder questions and options of that course's final test: `/instructor/courses/:id/quiz`, `/instructor/quiz/:quizId/questions`, `/instructor/questions/:id`, `/instructor/quiz/:quizId/questions/order` (same router as `/admin`).
- Server rule: ADMIN or an assigned instructor; an unassigned instructor gets `NOT_ASSIGNED`, other roles `FORBIDDEN`. Instructors still cannot edit course details or lessons.
- Instructor UI: `/instructor/courses/:id/quiz` ("Final test" on the instructor dashboard).

### 16.4 Course pinning is admin-only
- Learners cannot pin. Removed: `UserPin`, `/me/pins`, `PIN_LIMIT`, and the learner pin UI.
- The admin pins courses on `/admin/courses`: a pin toggle per row and a drag-to-reorder (or up/down) list of pinned courses. Stored as `Course.pinOrder` (null = not pinned). No limit. Only PUBLISHED courses can be pinned; moving a course out of PUBLISHED clears its pin.
- API: `GET /admin/courses/pins`, `POST|DELETE /admin/courses/:id/pin`, `PUT /admin/courses/pins { ids }`.
- Every learner-facing course list (home catalog, search/filter results) sorts pinned courses first by `pinOrder`, then the normal order. No "pinned" label or field is sent to learners.
- Tests: ordering, publish-only pinning, admin-only access.

## 17. Client change request (2026-11-22, later) — course reviews (overrides section 11)

### 17.1 Learners
- A learner can rate (1 to 5 stars) and review a course once their enrollment for it is `COMPLETED`. One review per learner per course (`CourseReview`, unique on course + user). They can edit or delete it later, also after restarting the course. Otherwise the server answers `NOT_COMPLETED`.
- Body: 1 to 2000 characters, trimmed. Partners cannot review.
- The form is on the course page (`/courses/:slug#reviews`); the passed result page links to it ("Rate this course").
- Privacy: the public list shows first name + last initial only ("Somchai J."), never the email.

### 17.2 Course page
- "Learner reviews" section: average (1 decimal), star breakdown 5..1, newest reviews first, 5 per page with "Show more". Header shows the average and count next to the course meta.
- `GET /courses/:slug` returns `rating { average, count }` (VISIBLE reviews only).

### 17.3 Admin moderation
- `/admin/reviews` (sidebar "Reviews"): filter by course, status, stars, text / learner. Actions: **Hide** (optional reason, admin-only), **Show**, **Delete**.
- Hidden: kept in the database, removed from the public list and the rating; the author still sees it, marked as hidden, and editing it does not make it public again. Moderation does not change `updatedAt` (the public "edited" mark is the learner's own edits).
- Every action writes an audit row: `review.hide`, `review.show`, `review.delete`.

### 17.4 API
- Public: `GET /courses/:slug/reviews?page&pageSize` -> `{ summary { average, count, distribution }, items, total, page, pages }`.
- Learner: `GET|PUT|DELETE /me/courses/:courseId/review` (`GET` -> `{ canReview, review }`).
- Admin: `GET /admin/reviews?courseId&status&rating&q&page`, `PATCH /admin/reviews/:id { status, reason? }`, `DELETE /admin/reviews/:id`.
- Tests (`api/tests/reviews.test.ts`): completed-only, one per course, validation, public summary and short names, hide/show/delete with audit, hidden stays hidden on edit, non-admin forbidden, own delete.

## 18. Client change request (2026-11-23) — admin Instructors page (overrides earlier sections)
- New admin page **`/admin/instructors`** (sidebar "Instructors", above Partners). Instructors are no longer shown or managed on `/admin/users` or `/admin/partners`.
  - Lists every `INSTRUCTOR` login: name, email, the courses they teach with each course's share, unpaid balance, status.
  - **Add instructor** (name + email): new email -> `INSTRUCTOR` login, `emailVerifiedAt` set, `mustChangePassword = true`, temporary password shown **once** (same rules as partner logins, 15.9). If the email belongs to a learner the API answers `ACCOUNT_EXISTS`; the admin confirms, then the learner is promoted and keeps their password. Partner or admin emails are refused.
  - Reset password (fallback; "Forgot password" first), ban/unban, remove the role (only when no course is assigned).
  - Courses and shares are still set in the course editor's Instructors tab.
- `/admin/users` shows learners and admins only (`GET /admin/users?roles=USER,ADMIN`).
- `/admin/partners` shows co-investors only. Instructor revenue rows are hidden there (`GET /admin/partners`; `?include=instructors` returns them, used by the revenue report filter).
- API: `GET /admin/instructors?q&status&page`, `POST /admin/instructors { name, email, promoteExisting? }`, `POST /admin/instructors/:id/reset-password`. Audit: `instructor.account_create`, `user.make_instructor`, `instructor.password_reset`. Tests: `api/tests/instructor-accounts.test.ts`.

## 19. Review stats on `/admin/reviews` (2026-11-23)
- Top of the admin Reviews page: average rating (stars), shown reviews, last 30 days (count + average), hidden count; star breakdown 5..1 (bar + count + %); rating per course (all courses view only).
- Stats count **shown** reviews only (what learners see); hidden reviews are only counted in "Hidden". They follow the course filter.
- Clicking a star row, a course, or "Hidden" sets the list filter.
- API: `GET /admin/reviews/stats?courseId` -> `{ average, count, distribution, hidden, last30Days { count, average }, byCourse[] }`. Test in `api/tests/reviews.test.ts`.

## 20. Performance pass (2026-11-23)
- **Uploaded images are shrunk** (`api/src/lib/images.ts`, sharp): max box per kind (logo 640x320, cover 1600, banner 1920, avatar 512, chat/slip 2000), never enlarged, EXIF rotation applied, metadata dropped. Logos and signatures stay PNG/JPG (certificate PDF uses pdf-lib); everything else is stored as WebP. A broken image is a 415. `api/scripts/shrink-uploads.ts` shrinks files uploaded before this (local storage; dry run by default).
- **Icons are SVG** from `@mdi/js`, not the MDI web font. `web/scripts/gen-icons.mjs` collects every `mdi-xxx` name in `src/` into `src/plugins/icons.generated.ts` (runs before dev/build; `npm run lint` fails if it is stale). After adding a new icon name, run `npm run icons` or restart dev.
- **hls.js is loaded only when a video plays** (own chunk), not with the lesson page.
- **API:** gzip (`compression`), security headers (`helmet`, no CSP; `/files` images allowed cross-origin), JSON body limit 1 MB except the base64 image routes (`UPLOAD_ROUTES` in `app.ts`, 25 MB). Too large -> 413, broken JSON -> 400.
- **Support inbox:** unread counts for all threads in one query (was one per thread on every 15 s refresh).
- **Indexes:** `Enrollment(courseId)`, `Order(status, paidAt)`, `RevenueEntry(createdAt)`.
- **Revenue report:** the chart uses per-day totals from the API (`daily`, grouped in the viewer's time zone `tz`), over all entries. The table shows the latest 1,000 entries and says so when there are more; CSV export has every entry.
