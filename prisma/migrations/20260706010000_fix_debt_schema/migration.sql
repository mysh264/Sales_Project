ALTER TABLE "Invoice"
ADD COLUMN IF NOT EXISTS "debtCollectionAmount" DECIMAL(12, 3) DEFAULT 0;

ALTER TABLE "Invoice"
ALTER COLUMN "debtCollectionAmount" DROP NOT NULL;

ALTER TABLE "Invoice"
ALTER COLUMN "debtCollectionAmount" SET DEFAULT 0;
