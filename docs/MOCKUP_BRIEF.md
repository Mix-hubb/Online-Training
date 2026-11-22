# Online Training — brief for building a UI mockup

Course website for Hidden Mines Co., Ltd. The first courses teach how to run and repair crypto-mining hardware (Antminer, Whatsminer, Avalon: hashboards, ASIC chips, power supplies, control boards, fans). Courses are free or paid once; there are no subscriptions. Prices are in USD, and each course also has a THB price. The UI is in English.

The pages, states, rules and API below already exist in working code; the mockup should cover them. The visual design is open (see section 1).

---

## 1. Visual direction (the design is yours to make)

The current build's look was rejected by the client, so do **not** copy it. Design fresh. The client's only fixed requirements:

- **Education / learning feel, white paired with blue** (light theme).
- **Small corner radius**, much less rounded than typical templates.
- **Must not look like generic AI-generated UI.** Avoid gradients, glowing effects, oversized rounded cards, emoji icons, decorative serif headlines and "hero + 3 feature cards" templates. It should feel like a serious, trustworthy training product.

Everything else (typography, layout, spacing, components, illustration style, colour shades) is open. Design both desktop and mobile.

The UI is built with Vue 3 + Vuetify 3. Designs that map onto standard components (cards, tables, tabs, dialogs, text fields, menus) are easiest to build.

---

## 2. Roles and areas

| Role | Area | Layout |
|---|---|---|
| Guest | Home, course pages, certificate verify | Public: header + footer |
| USER (learner) | Learning, test, profile, orders, messages | Public layout |
| INSTRUCTOR | `/instructor/*`, only for courses they are assigned to | Own layout with sidebar |
| PARTNER (co-investor) | `/partner/*`, sees only its own revenue share | Own layout with sidebar |
| ADMIN | `/admin/*`, everything | Admin layout: left sidebar + top bar ("View site", bell, avatar) |

- **Public header:** logo + "Online Training", Courses, My learning, bell with unread count, avatar menu. Logged-out visitors see Log in and Sign up instead.
- **Public footer:** brand, links, company contact, partner logo strip.
- **Mobile:** the header collapses to a hamburger menu; staff sidebars become drawers.

---

## 3. Pages (all of these exist)

### Public / learner

| Route | Page | Content and states |
|---|---|---|
| `/` | Home | <ul><li>Banner carousel (admin-managed)</li><li>"Pinned" row: logged-in users, up to 6 pinned courses</li><li>"Continue learning" with progress and a Resume button</li><li>All courses: search plus filters for Category, Level, Price (free/paid) and Tag</li><li>Course card grid</li><li>"Our partners" logo strip</li></ul> |
| `/login`, `/register` | Auth | One page with tabs. Email + password, Google sign-in button, "Forgot password?" |
| `/verify-email?token=` | Verify email | States: verifying, success, expired/invalid with "Resend" |
| `/forgot-password`, `/reset-password?token=` | Password reset | Request form, then a sent message, then a new-password form |
| `/account/change-password` | Forced change | Shown on a partner's first login. Every other page is blocked until it is done |
| `/courses/:slug` | Course page | <ul><li>Breadcrumb, tags, title, summary</li><li>Meta: lessons, duration, "Final test + certificate", instructor</li><li>Intro video</li><li>"What you will learn"</li><li>Lesson outline (locked/unlocked)</li><li>Sticky buy box: USD/THB price, "Lifetime access · Certificate on passing"</li><li>Buttons: Log in to buy / Buy / Start free / Continue</li><li>Pin button</li><li>"Ask the instructor"</li></ul> |
| (dialog) | Payment method picker | <ul><li>Card (Stripe)</li><li>PromptPay (THB only)</li><li>Bank transfer</li><li>Bitcoin</li></ul> |
| `/checkout/return` | Payment return | "Confirming your payment…" while polling the order, then Success or Failed |
| `/checkout/bank-transfer/:orderId` | Bank transfer | Bank details, amount, upload slip image. States: Awaiting slip, Under review, Rejected (with reason; upload again) |
| `/learn/:slug` | Player | <ul><li>Video with a quality menu (Auto / 720p / 1080p / 4K, never higher than the source)</li><li>Lesson sidebar: completed ✓, current, locked 🔒</li><li>Course progress bar</li><li>"Final test" unlocks when every lesson is complete</li><li>Course chat link</li></ul> |
| `/learn/:slug/quiz` | Final test | <ul><li>Sticky timer (if there is a time limit)</li><li>"Attempt 1 of 3"</li><li>Question navigator</li><li>MCQ (single answer) and Essay (text box)</li><li>Submit confirmation dialog</li></ul> |
| `/learn/:slug/result/:attemptId?` | Result, 4 states | <ol><li>**Passed:** score, answer review, certificate link</li><li>**Failed, attempts left:** score only, no correct answers shown, Retry</li><li>**Waiting for instructor:** essays pending</li><li>**No attempts left:** "Lessons restarted" notice (progress reset; no new purchase needed)</li></ol> |
| `/profile` | Profile | <ul><li>User info</li><li>"My learning" filter: All / In progress / Completed</li><li>Status labels: In progress, Ready for final test, Waiting for instructor, Lessons restarted, Completed</li><li>Certificates (PDF download)</li><li>Notifications list</li></ul> |
| `/profile/orders` | Orders | Date, course, method, amount, status (Pending, Awaiting slip, Paid, Refunded, Failed), receipt |
| `/messages/:threadId?` | Messages | <ul><li>Thread list: Support thread plus one per course question</li><li>Chat with up to 3 images per message (≤5 MB each)</li><li>Unread badges</li></ul> |
| `/certificates/:number` | Public verify | Certificate number (e.g. `OT-2026-000123`), name, course, date, "Valid". Not found state |
| `/course-unavailable`, `/locked`, `/403`, 404 | Error pages | |

### Admin (`/admin`)

| Route | Page |
|---|---|
| `/admin` | **Dashboard:** <ul><li>stat cards (published courses, learners, sales this month)</li><li>Needs attention: essays to grade, bank slips to review, open support conversations</li><li>recent orders table</li></ul> |
| `/admin/courses` | Course list: thumbnail, title, status (Draft / Published / Archived), price, learners, actions |
| `/admin/courses/new`, `/admin/courses/:id` | **Course editor, tabs:** <ul><li>**Details:** title, slug, summary, outcomes, category, tags, level, USD + THB price, free toggle, cover, intro video, status</li><li>**Lessons (n):** list with reorder, upload video with progress, video status Processing/Ready/Failed</li><li>**Final test:** pass %, time limit, max attempts, question editor for MCQ/Essay with reorder</li><li>**Instructors:** max 2</li><li>**Revenue shares:** partner + %, total ≤ 100%</li><li>**Learners:** progress per learner</li></ul> |
| `/admin/courses/:id/preview` | Preview the course as a learner |
| `/admin/grading`, `/admin/grading/:attemptId` | Essay grading queue, then the grading form: points per essay + comment |
| `/admin/payments/review` | Bank slip review: slip image, order, Approve / Reject with reason |
| `/admin/support/:threadId?` | Support inbox (same chat UI) |
| `/admin/landing` | Banners (image, link, alt, reorder) and home sections |
| `/admin/taxonomy` | Categories and tags (add/rename/delete) |
| `/admin/users` | Users table: search, role, status, Ban/Unban, make/remove instructor |
| `/admin/partners` | Partners: logo, website, show on home toggle, order, "Create login" (temporary password shown once), "Reset password" |
| `/admin/revenue` | Revenue ledger with filters (date, course, partner, currency), CSV export, outstanding balance per partner, "Mark as paid", payout history |
| `/admin/certificate` | Certificate template: heading, issuer, signer name/title, logo, signature, accent colour, PDF preview |
| `/admin/settings` | Bank details for bank transfer |
| `/admin/audit` | Audit log (read-only) |

### Instructor (`/instructor`)

| Route | Page |
|---|---|
| `/instructor` | Dashboard: assigned courses (cards), counts to grade, unread messages |
| `/instructor/courses/:id/learners` | Learners and progress, only for their courses |
| `/instructor/grading/:attemptId?` | Grading queue + form, only for their courses |
| `/instructor/messages/:threadId?` | Course questions from learners |
| `/instructor/earnings` | Own revenue share: totals per currency, ledger, payouts, CSV |

### Partner (`/partner`)

| Route | Page |
|---|---|
| `/partner/revenue-sharing` | Earned / Paid / Outstanding per currency, filters, entries table with share % snapshot (no buyer identity), CSV |
| `/partner/payouts` | Payouts received |

---

## 4. Key rules the mockup should show

- **Lessons:** lessons unlock in order. A lesson is complete at 90% watched, and the player resumes from the last position.
- **Final test:** unlocks only after all lessons are done. Each test has a pass %, an optional time limit and a maximum number of attempts.
- **Answer review:** correct answers are shown **only after passing**.
- **Failing every attempt:** lesson progress restarts (a new "cycle") and the learner gets fresh attempts without paying again.
- **Essays:** an attempt with essays waits for grading, then the learner gets a notification.
- **Certificate:** issued on pass, with a public number and a verify page.
- **Course status:** Archived courses are hidden and cannot be bought, but owners keep access.
- **Banned users:** blocked everywhere.
- **Notifications:** in-app only (bell). Sent when essays are graded, a certificate is ready, a payment is received, lessons are restarted, or a new chat message arrives.
- **Limits:** up to 6 pinned courses per user and 2 instructors per course; revenue shares per course must not exceed 100%.

---

## 5. API (Express, base `/`; JSON; auth via httpOnly cookie)

**Auth** `/auth`: `POST register, verify-email, resend-verification, login, google, forgot-password, reset-password, logout, change-password` · `GET me`

**Catalog:** `GET /courses` (search + filters) · `GET /courses/:slug` · `GET /courses/:slug/intro` · `GET /categories` · `GET /tags` · `GET /landing` (banners, sections, partner logos)

**Learning:**
- `POST /courses/:id/enroll` (free)
- `GET /me/courses`
- `GET /me/continue`
- `GET /courses/:slug/learn`
- `GET /lessons/:id/play` (signed video URL)
- `PUT /lessons/:id/progress`

**Pins:** `GET /me/pins` · `POST /me/pins/:courseId` · `DELETE /me/pins/:courseId`

**Test:**
- `GET /courses/:id/quiz`
- `POST /courses/:id/quiz/start`
- `GET /attempts/:id`
- `PUT /attempts/:id/answers`
- `POST /attempts/:id/submit`

**Payments:**
- Stripe card/PromptPay: `POST /courses/:id/checkout`
- Orders: `GET /orders`, `GET /orders/:id`, `GET /orders/by-session/:sessionId`
- Bank transfer: `GET /payments/bank-details`, `POST /courses/:id/checkout/bank-transfer`, `POST /orders/:id/slip`, `GET /orders/:id/slips`
- Webhooks: `/stripe/webhook`, `/crypto/webhook`

**Certificates:** `GET /certificates/:number` (public) · `GET /me/certificates` · `GET /me/certificates/:id/pdf`

**Notifications:** `GET /notifications` · `POST /notifications/:id/read` · `POST /notifications/read-all`

**Chat:**
- `GET /me/threads`
- `POST /me/threads/support`
- `POST /courses/:id/threads`
- `GET|POST /threads/:id/messages`
- `POST /threads/:id/read`
- `POST /threads/:id/close`
- `GET /attachments/:id/url` (signed link)

**Instructor** `/instructor`:
- `GET dashboard`
- `GET courses`
- `GET courses/:courseId/learners`
- `GET grading`, `GET|POST grading/:attemptId`
- `GET threads`
- `GET earnings`, `GET earnings.csv`

**Partner:** `GET /partner/summary` · `GET /partner/revenue` · `GET /partner/revenue.csv` · `GET /partner/payouts`

**Admin** `/admin`:
- Dashboard: `GET dashboard`
- Courses:
  - `GET|POST courses`
  - `GET|PATCH|DELETE courses/:id`
  - `POST courses/:id/status`
  - `GET courses/:id/learners`
  - `POST courses/:id/intro-upload-init`
- Lessons:
  - `POST courses/:id/lessons`
  - `PATCH|DELETE lessons/:id`
  - `PUT courses/:id/lessons/order`
  - `POST lessons/:id/upload-init`
  - `GET lessons/:id/video-status`
- Test:
  - `GET|PUT courses/:id/quiz`
  - `POST quiz/:quizId/questions`
  - `PATCH|DELETE questions/:id`
  - `PUT quiz/:quizId/questions/order`
- Instructors:
  - `GET|POST courses/:id/instructors`
  - `DELETE courses/:id/instructors/:userId`
  - `POST users/:id/make-instructor|remove-instructor`
- Revenue shares: `GET|PUT courses/:id/revenue-shares`
- Grading: `GET grading`, `GET|POST grading/:attemptId`
- Bank slips: `GET payments/review`, `POST payments/:orderId/approve|reject`
- Support: `GET threads`
- Landing:
  - `GET|POST banners`
  - `PUT banners/order`
  - `PATCH|DELETE banners/:id`
  - `GET|PUT landing`
- Taxonomy: `GET|POST categories`, `PATCH|DELETE categories/:id` (tags use the same routes)
- Users: `GET users`, `GET users/:id`, `POST users/:id/ban|unban`
- Partners:
  - `GET|POST partners`
  - `PUT partners/logo-order`
  - `PATCH|DELETE partners/:id`
  - `POST partners/:id/logo`
  - `POST partners/:id/account`
  - `POST partners/:id/account/reset-password`
- Revenue:
  - `GET revenue`, `GET revenue.csv`
  - `GET revenue/balances`
  - `GET|POST revenue/payouts`
- Certificate: `GET|PUT certificate-template`, `GET certificate-template/preview.pdf`
- Settings: `GET|PUT settings/bank-details`
- Audit: `GET audit`

**Error codes the UI shows:**
- Access and account: `UNAUTHENTICATED`, `FORBIDDEN`, `BANNED`, `MUST_CHANGE_PASSWORD`
- Learning and test: `NOT_ENROLLED`, `LOCKED`, `NO_ATTEMPTS_LEFT`
- Limits: `PIN_LIMIT`, `INSTRUCTOR_LIMIT`, `NOT_ASSIGNED`
- Chat attachments: `ATTACHMENT_TOO_LARGE`, `TOO_MANY_ATTACHMENTS`, `UNSUPPORTED_FILE_TYPE`
- Payments: `PAYMENT_METHOD_UNAVAILABLE`, `SLIP_ALREADY_REVIEWED`

---

## 6. Data (main models and statuses)

- **Users:**
  - User (role USER / INSTRUCTOR / PARTNER / ADMIN; status ACTIVE / BANNED)
  - AuthToken
- **Catalog:**
  - Category, Tag
  - Course (DRAFT / PUBLISHED / ARCHIVED; level BEGINNER / INTERMEDIATE / ADVANCED; USD + THB price)
  - Lesson (video PROCESSING / READY / FAILED), LessonRendition
- **Learning:**
  - Enrollment (IN_PROGRESS / COMPLETED, cycle)
  - LessonProgress
  - UserPin
- **Test:**
  - Quiz, Question (MCQ / ESSAY), Option
  - QuizAttempt (IN_PROGRESS / PENDING_REVIEW / GRADED), AttemptAnswer
- **Certificates:** Certificate, CertificateTemplate
- **Payments:**
  - Order (PENDING / AWAITING_SLIP / PAID / REFUNDED / FAILED; provider STRIPE / BANK_TRANSFER / CRYPTO)
  - PaymentSlip (PENDING / APPROVED / REJECTED)
- **Revenue:** Partner, CourseRevenueShare, RevenueEntry (UNPAID / PAID), PartnerPayout
- **Chat:** SupportThread (SUPPORT / COURSE; OPEN / CLOSED), ThreadMessage, MessageAttachment
- **Site:** Notification, Banner, LandingSection, AuditLog, CourseInstructor

---

## 7. Sample content for the mockup

- **Courses:**
  - "Mine Safety Basics": Safety, Beginner, Free, 3 lessons, 6 min
  - "Underground Surveying": Geology, Intermediate, $49.00 / THB 1,590, 4 lessons, 12 min
- **Certificate number format:** `OT-2026-000001`
- **Open client decisions** (show as placeholders, do not decide):
  - which Bitcoin provider to use
  - whether a refund removes access
  - the real bank details
