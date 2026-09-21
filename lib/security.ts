import bcrypt from "bcryptjs";

export async function verifyPasswordStepUp(plainPassword: string, passwordHash: string | null): Promise<boolean> {
  if (!plainPassword || !passwordHash) return false;
  return bcrypt.compare(plainPassword, passwordHash);
}
