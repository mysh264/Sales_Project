import bcrypt from "bcryptjs";

export async function bootstrapPasswordNeedsSync(
  plainPassword: string,
  existingHash: string | null,
): Promise<boolean> {
  if (!existingHash) return true;

  try {
    return !(await bcrypt.compare(plainPassword, existingHash));
  } catch {
    return true;
  }
}
