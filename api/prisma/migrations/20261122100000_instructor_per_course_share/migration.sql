-- Instructors are paid a share per assigned course (CourseInstructor.sharePercentBp), taken before partners.
-- RevenueEntry.kind tells instructor entries from co-investor entries. Existing entries stay PARTNER.
-- CreateEnum
CREATE TYPE "EntryKind" AS ENUM ('INSTRUCTOR', 'PARTNER');

-- AlterTable
ALTER TABLE "CourseInstructor" ADD COLUMN     "sharePercentBp" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RevenueEntry" ADD COLUMN     "kind" "EntryKind" NOT NULL DEFAULT 'PARTNER';


-- Data: old entries of partners linked to an INSTRUCTOR account were instructor earnings; label them so.
-- Their amounts are not changed (ledger rows are never edited beyond labels/payout links).
UPDATE "RevenueEntry" e SET "kind" = 'INSTRUCTOR'
FROM "Partner" p JOIN "User" u ON u."id" = p."userId"
WHERE e."partnerId" = p."id" AND u."role" = 'INSTRUCTOR';

-- Instructors no longer have a share of total revenue; they are paid per course from now on.
UPDATE "Partner" p SET "sharePercentBp" = 0
FROM "User" u WHERE u."id" = p."userId" AND u."role" = 'INSTRUCTOR';
