# Test accounts (local development only)

Created by the seed (`api/prisma/seed.ts`). All accounts are email-verified and share one password:
`Demo-pass-2026`, unless you set `SEED_PASSWORD` in `api/.env` before seeding.

Never use these on a real deployment. Change or remove them before going live.

| Role | Email | Name | Opens at | What to test |
| --- | --- | --- | --- | --- |
| Admin | admin@example.com | Admin | `/admin` | Courses, lessons, final test, bank slips, grading, partners, revenue, landing page, users, settings |
| Learner (has courses) | learner@example.com | Somchai Learner | `/` | Enrolled in both published courses: learning, quiz, results, certificate, orders, messages |
| Learner (new) | new.learner@example.com | New Learner | `/` | No enrolments: start a free course, buy a paid course, bank transfer slip |
| Instructor | instructor@example.com | Dr. Napat Instructor | `/instructor` | Assigned to Underground Surveying: learners, grading written answers, messages, earnings |
| Partner | partner@example.com | [Partner company] | `/partner/revenue-sharing` | Revenue share report and payouts for its courses |

Notes

- Log in at `/login` (the web app runs on http://localhost:5173).
- To get every account back to its starting state, run `npx prisma migrate reset` in `api/` (this wipes the local database).
- Running `npm run prisma:seed` again only adds `new.learner@example.com` if it is missing; it does not touch other data.
- A new learner can also sign up from `/register`; in development the verification email is printed in the API log.
