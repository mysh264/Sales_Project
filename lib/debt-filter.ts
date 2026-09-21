import { DebtStatus, type Prisma } from "@/generated/prisma/client";

const ACTIVE_STATUSES = [DebtStatus.OPEN, DebtStatus.PARTIALLY_PAID] as const;

export function debtStatusWhere(status: string | undefined): Prisma.CustomerDebtWhereInput {
  if (status === DebtStatus.PAID || status === DebtStatus.WRITTEN_OFF) {
    return { status };
  }
  if (status === DebtStatus.OPEN || status === DebtStatus.PARTIALLY_PAID) {
    return { status, balanceAmount: { gt: 0 } };
  }
  return { status: { in: [...ACTIVE_STATUSES] }, balanceAmount: { gt: 0 } };
}
