-- Failing every final-test attempt no longer restarts the lessons (2026-11-26).
-- Learners already moved to a new cycle before this change get their lesson progress back:
-- copy the previous cycle's progress into the current cycle, keeping whichever is further along.
-- Data only; no schema change.
INSERT INTO "LessonProgress" ("id", "enrollmentId", "lessonId", "cycle", "watchedSec", "lastPositionSec", "completed", "updatedAt")
SELECT gen_random_uuid()::text, p."enrollmentId", p."lessonId", e."cycle", p."watchedSec", p."lastPositionSec", p."completed", NOW()
FROM "LessonProgress" p
JOIN "Enrollment" e ON e."id" = p."enrollmentId"
WHERE e."cycle" > 1 AND e."status" <> 'COMPLETED' AND p."cycle" = e."cycle" - 1
ON CONFLICT ("enrollmentId", "lessonId", "cycle") DO UPDATE SET
  "watchedSec" = GREATEST("LessonProgress"."watchedSec", EXCLUDED."watchedSec"),
  "completed" = "LessonProgress"."completed" OR EXCLUDED."completed",
  "updatedAt" = NOW();
