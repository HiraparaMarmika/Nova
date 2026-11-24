CREATE TYPE "CustomerApprovalStatus" AS ENUM ('PENDING', 'NEEDS_CHANGES', 'REJECTED', 'APPROVED');

ALTER TABLE "Customer" ADD COLUMN "approvalStatus" "CustomerApprovalStatus";
UPDATE "Customer" SET "approvalStatus" = 'APPROVED' WHERE "approvalStatus" IS NULL;
ALTER TABLE "Customer" ALTER COLUMN "approvalStatus" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "approvalStatus" SET DEFAULT 'PENDING';

CREATE INDEX "Customer_approvalStatus_createdAt_idx" ON "Customer"("approvalStatus", "createdAt");
