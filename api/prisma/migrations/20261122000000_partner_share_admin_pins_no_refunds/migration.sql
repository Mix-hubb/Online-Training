-- Change request 2026-11-22: no refunds (REFUNDED status and reversal entries removed),
-- revenue share per partner (Partner.sharePercentBp replaces CourseRevenueShare),
-- admin-only course pins (Course.pinOrder replaces UserPin).
-- Note: the enum change fails if any order is still REFUNDED; there were none in dev.

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'AWAITING_SLIP', 'PAID', 'FAILED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "CourseRevenueShare" DROP CONSTRAINT "CourseRevenueShare_courseId_fkey";

-- DropForeignKey
ALTER TABLE "CourseRevenueShare" DROP CONSTRAINT "CourseRevenueShare_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "UserPin" DROP CONSTRAINT "UserPin_courseId_fkey";

-- DropForeignKey
ALTER TABLE "UserPin" DROP CONSTRAINT "UserPin_userId_fkey";

-- DropIndex
DROP INDEX "RevenueEntry_reversesId_key";

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "pinOrder" INTEGER;

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "sharePercentBp" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RevenueEntry" DROP COLUMN "reversesId";

-- DropTable
DROP TABLE "CourseRevenueShare";

-- DropTable
DROP TABLE "UserPin";

