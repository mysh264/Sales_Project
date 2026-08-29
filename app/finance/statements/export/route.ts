import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildCsv, csvResponse } from "@/lib/csv";
import { getBranchScope, branchWhere } from "@/lib/branch-scope";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return new Response("Unauthorized", { status: 403 });

  const scope = await getBranchScope();
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";

  const customers = await prisma.customer.findMany({
    where: {
      ...branchWhere(scope),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      debts: { some: { balanceAmount: { gt: new Prisma.Decimal(0) }, status: { in: ["OPEN", "PARTIALLY_PAID"] } } },
    },
    include: {
      branch: true,
      debts: {
        where: { balanceAmount: { gt: new Prisma.Decimal(0) }, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = customers.map((c) => [
    c.customerNumber,
    c.name,
    c.branch?.name ?? "",
    c.debts.length,
    c.debts.reduce((sum, d) => sum.add(d.balanceAmount), new Prisma.Decimal(0)).toFixed(3),
  ]);

  const csv = buildCsv(["customerNumber", "name", "branch", "openInvoices", "balance"], rows);
  return csvResponse(`customer-statements-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
