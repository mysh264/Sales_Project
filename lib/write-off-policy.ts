import { Prisma, UserRole } from "@/generated/prisma/client";

/** Managers may write off up to this amount without escalating to ADMIN/GM. */
export const DEFAULT_MANAGER_WRITE_OFF_LIMIT = new Prisma.Decimal("50.000");

export function managerWriteOffLimit(): Prisma.Decimal {
  const raw = process.env.WRITE_OFF_MANAGER_LIMIT?.trim();
  if (!raw) return DEFAULT_MANAGER_WRITE_OFF_LIMIT;
  try {
    const parsed = new Prisma.Decimal(raw);
    return parsed.isNegative() ? DEFAULT_MANAGER_WRITE_OFF_LIMIT : parsed;
  } catch {
    return DEFAULT_MANAGER_WRITE_OFF_LIMIT;
  }
}

/**
 * MANAGER can write off amounts at or below the configured limit.
 * ADMIN and GENERAL_MANAGER may write off any amount.
 */
export function assertWriteOffAuthorized(actorRole: UserRole, amount: Prisma.Decimal) {
  if (actorRole === UserRole.ADMIN || actorRole === UserRole.GENERAL_MANAGER) {
    return;
  }

  if (actorRole !== UserRole.MANAGER) {
    throw new Error("Only a manager or administrator can write off debt.");
  }

  const limit = managerWriteOffLimit();
  if (amount.greaterThan(limit)) {
    throw new Error(
      `Write-offs above ${limit.toFixed(3)} require an administrator or general manager.`,
    );
  }
}
