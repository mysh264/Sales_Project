import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { ButtonLink } from "@/components/ui/Button";
import { formatOmr } from "@/lib/money";
import { getBranchScope, branchWhere } from "@/lib/branch-scope";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function StatementsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const scope = await getBranchScope();
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() || "";

  const where: Prisma.CustomerWhereInput = {
    ...branchWhere(scope),
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    debts: { some: { balanceAmount: { gt: new Prisma.Decimal(0) }, status: { in: ["OPEN", "PARTIALLY_PAID"] } } },
  };

  const customers = await prisma.customer.findMany({
    where,
    include: {
      branch: true,
      debts: {
        where: { balanceAmount: { gt: new Prisma.Decimal(0) }, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
        include: { invoice: { select: { invoiceNumber: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = customers.map((c) => ({
    id: c.id,
    name: c.name,
    customerNumber: c.customerNumber,
    branch: c.branch?.name ?? "—",
    balance: c.debts.reduce((sum, d) => sum.add(d.balanceAmount), new Prisma.Decimal(0)),
    openInvoices: c.debts.length,
  }));

  const totalOutstanding = rows.reduce((sum, r) => sum.add(r.balance), new Prisma.Decimal(0));

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto max-w-screen-xl flex flex-col gap-6 animate-fade-in">
        <PageHeader
          eyebrow="Finance"
          title="Customer Statements"
          description="Customers with outstanding balances. Open a statement to review invoice-level debt and export it."
          actions={
            <ButtonLink href={`/finance/statements/export${q ? `?q=${encodeURIComponent(q)}` : ""}`} variant="primary">
              Export CSV
            </ButtonLink>
          }
        />

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat label="Customers Owing" value={rows.length} tone="default" />
          <Stat label="Total Outstanding" value={formatOmr(totalOutstanding)} tone="danger" />
          <Stat label="Scope" value={scope?.canSeeAllBranches ? "All Branches" : (scope?.branchId ? "Branch" : "—")} tone="default" />
        </section>

        <Card>
          <CardHeader title="Outstanding Balances" description="Filter by customer name, then open a statement for the invoice-level breakdown." />
          <form method="get" className="mb-4 flex gap-3">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search customer name"
              className="ui-input flex-1"
            />
            <button type="submit" className="ui-btn ui-btn-primary">
              Search
            </button>
          </form>
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Number</th>
                  <th>Branch</th>
                  <th className="text-right">Open Invoices</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">Statement</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center font-bold text-slate-500" colSpan={6}>
                      No customers with outstanding balances.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td className="is-strong">{r.name}</td>
                      <td className="font-semibold text-slate-600">{r.customerNumber}</td>
                      <td className="font-semibold text-slate-600">{r.branch}</td>
                      <td className="num">{r.openInvoices}</td>
                      <td className="num text-rose-600">{formatOmr(r.balance)}</td>
                      <td>
                        <div className="flex justify-end">
                          <Link href={`/finance/statements/${r.id}`} className="ui-btn ui-btn-ghost ui-btn-sm">
                            Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}
