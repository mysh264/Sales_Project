import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Hash statement share tokens at rest (SHA-256 hex). */
export function hashStatementToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function mintStatementToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("hex");
  return { token, tokenHash: hashStatementToken(token) };
}

/** Constant-time compare of a presented token against a stored hash (or legacy plaintext). */
export function statementTokenMatches(presented: string, stored: string | null | undefined): boolean {
  if (!presented || !stored) return false;
  const presentedHash = hashStatementToken(presented);
  try {
    const a = Buffer.from(presentedHash, "utf8");
    const b = Buffer.from(stored, "utf8");
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return true;
    }
  } catch {
    // fall through to legacy plaintext compare
  }
  // Legacy rows may still store the raw token until regenerated.
  try {
    const a = Buffer.from(presented, "utf8");
    const b = Buffer.from(stored, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
