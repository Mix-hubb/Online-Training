-- 2026-11-27: instructors sign up and are approved by an admin; instructors own the courses they create (admin approves each one); lessons can be free previews; one revenue share per instructor.
-- CreateEnum
CREATE TYPE "InstructorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "CourseStatus" ADD VALUE 'IN_REVIEW';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "isFreePreview" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InstructorProfile" (
    "userId" TEXT NOT NULL,
    "status" "InstructorStatus" NOT NULL DEFAULT 'PENDING',
    "phone" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "expertise" TEXT[],
    "sharePercentBp" INTEGER NOT NULL DEFAULT 0,
    "rejectReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "InstructorProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "InstructorDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstructorProfile_status_idx" ON "InstructorProfile"("status");

-- CreateIndex
CREATE INDEX "InstructorDocument_userId_idx" ON "InstructorDocument"("userId");

-- CreateIndex
CREATE INDEX "Course_ownerId_idx" ON "Course"("ownerId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorProfile" ADD CONSTRAINT "InstructorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorDocument" ADD CONSTRAINT "InstructorDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InstructorProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Instructors created by an admin before this change are already trusted: give them an approved profile.
INSERT INTO "InstructorProfile" ("userId", "status", "phone", "headline", "bio", "expertise", "reviewedAt")
SELECT u."id", 'APPROVED', '', '', '', '{}', CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role" = 'INSTRUCTOR'
ON CONFLICT ("userId") DO NOTHING;

-- Same as 20261125120000_lock_public_tables for the new tables: row level security on, no policies
-- (only the API server, the table owner, reads them; Supabase Data API roles see nothing).
ALTER TABLE "InstructorProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstructorDocument" ENABLE ROW LEVEL SECURITY;
