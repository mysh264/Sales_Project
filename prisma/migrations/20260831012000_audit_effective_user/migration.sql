ALTER TABLE "AuditLog"
  ADD COLUMN "effectiveUserId" TEXT;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_effectiveUserId_fkey"
  FOREIGN KEY ("effectiveUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AuditLog_effectiveUserId_timestamp_idx"
  ON "AuditLog"("effectiveUserId", "timestamp");
