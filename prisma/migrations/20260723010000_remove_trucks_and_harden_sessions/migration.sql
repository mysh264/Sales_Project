DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TRUCK_LOAD_FULL' AND enumtypid = '"CylinderMovementType"'::regtype) THEN
    ALTER TYPE "CylinderMovementType" RENAME VALUE 'TRUCK_LOAD_FULL' TO 'DAILY_LOAD_FULL';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TRUCK_RETURN_FULL' AND enumtypid = '"CylinderMovementType"'::regtype) THEN
    ALTER TYPE "CylinderMovementType" RENAME VALUE 'TRUCK_RETURN_FULL' TO 'DAILY_RETURN_FULL';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TRUCK_RETURN_EMPTY' AND enumtypid = '"CylinderMovementType"'::regtype) THEN
    ALTER TYPE "CylinderMovementType" RENAME VALUE 'TRUCK_RETURN_EMPTY' TO 'DAILY_RETURN_EMPTY';
  END IF;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

ALTER TABLE "DailyReconciliationItem"
  ADD COLUMN IF NOT EXISTS "invoiceSoldFull" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "invoiceEmptyReturned" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "varianceFull" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "varianceEmpty" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CylinderMovement" ADD COLUMN IF NOT EXISTS "reconciliationId" TEXT;
CREATE INDEX IF NOT EXISTS "CylinderMovement_reconciliationId_idx" ON "CylinderMovement"("reconciliationId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CylinderMovement_reconciliationId_fkey') THEN
    ALTER TABLE "CylinderMovement"
      ADD CONSTRAINT "CylinderMovement_reconciliationId_fkey"
      FOREIGN KEY ("reconciliationId") REFERENCES "DailyReconciliation"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "CylinderMovement" DROP CONSTRAINT IF EXISTS "CylinderMovement_loadSessionId_fkey";
DROP INDEX IF EXISTS "CylinderMovement_loadSessionId_idx";
ALTER TABLE "CylinderMovement" DROP COLUMN IF EXISTS "loadSessionId";

DROP TABLE IF EXISTS "TruckReturnItem";
DROP TABLE IF EXISTS "TruckLoadItem";
DROP TABLE IF EXISTS "TruckLoadSession";
DROP TABLE IF EXISTS "Truck";
