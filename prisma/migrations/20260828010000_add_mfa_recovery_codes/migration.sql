-- Add storage for TOTP recovery codes (one-time backup codes so losing the authenticator
-- does not permanently lock the account). Codes are stored as bcrypt hashes in a JSON array
-- so the database never holds plaintext codes.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mfaRecoveryCodes" TEXT;
