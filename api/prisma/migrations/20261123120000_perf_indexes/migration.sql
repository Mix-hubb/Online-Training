-- Performance review 2026-11-23: indexes for the filters that grow with data.
-- CreateIndex
CREATE INDEX "Enrollment_courseId_idx" ON "Enrollment"("courseId");

-- CreateIndex
CREATE INDEX "Order_status_paidAt_idx" ON "Order"("status", "paidAt");

-- CreateIndex
CREATE INDEX "RevenueEntry_createdAt_idx" ON "RevenueEntry"("createdAt");
