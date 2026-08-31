-- Master Tester feature: TESTER role + isTestUser flag on User.
-- Both changes are additive: the new enum value is appended, and the new
-- boolean column defaults to false, so existing human users are unaffected
-- and can never be impersonated.

-- AlterEnum: add TESTER to the UserRole enum (Postgres allows adding values).
ALTER TYPE "UserRole" ADD VALUE 'TESTER';

-- AlterTable: add isTestUser with safe default.
ALTER TABLE "User" ADD COLUMN     "isTestUser" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: fast lookup when listing the impersonation target set.
CREATE INDEX "User_isTestUser_idx" ON "User"("isTestUser");
