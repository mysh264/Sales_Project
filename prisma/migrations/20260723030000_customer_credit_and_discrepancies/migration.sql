ALTER TYPE "ReconciliationStatus" ADD VALUE IF NOT EXISTS 'DISCREPANCY_PENDING' BEFORE 'EVENING_RECONCILED';

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "customerNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "creditBalance" DECIMAL(12,3) NOT NULL DEFAULT 0;

UPDATE "Customer"
SET "customerNumber" = 'CUS-' || "id"
WHERE "customerNumber" IS NULL;

ALTER TABLE "Customer" ALTER COLUMN "customerNumber" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_customerNumber_key" ON "Customer"("customerNumber");

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "creditApplied" DECIMAL(12,3) NOT NULL DEFAULT 0;

ALTER TABLE "DailyReconciliation"
  ADD COLUMN IF NOT EXISTS "discrepancyApprovedById" TEXT,
  ADD COLUMN IF NOT EXISTS "discrepancyApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "discrepancyReason" TEXT;

CREATE INDEX IF NOT EXISTS "DailyReconciliation_discrepancyApprovedById_idx"
  ON "DailyReconciliation"("discrepancyApprovedById");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DailyReconciliation_discrepancyApprovedById_fkey'
  ) THEN
    ALTER TABLE "DailyReconciliation"
      ADD CONSTRAINT "DailyReconciliation_discrepancyApprovedById_fkey"
      FOREIGN KEY ("discrepancyApprovedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
