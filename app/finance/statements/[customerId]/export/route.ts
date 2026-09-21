import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildCsv, csvResponse } from "@/lib/csv";
import { getBranchScope, branchWhere } from "@/lib/branch-scope";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return new Response("Unauthorized", { status: 403 });

  const { customerId } = await params;
  const scope = await getBranchScope();

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, ...branchWhere(scope) },
    include: {
      branch: true,
      debts: {
        where: { balanceAmount: { gt: new Prisma.Decimal(0) }, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
        include: { invoice: { select: { invoiceNumber: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) return new Response("Not found", { status: 404 });

  const rows = customer.debts.map((debt) => [
    debt.invoice.invoiceNumber,
    debt.invoice.createdAt.toISOString().slice(0, 10),
    debt.originalAmount.toFixed(3),
    debt.originalAmount.sub(debt.balanceAmount).toFixed(3),
    debt.balanceAmount.toFixed(3),
    debt.status,
  ]);

  const csv = buildCsv(["invoiceNumber", "date", "originalAmount", "paidAmount", "balance", "status"], rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`statement-${customer.customerNumber}-${stamp}.csv`, csv);
}
