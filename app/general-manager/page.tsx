import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permission-guard";
import { Permissions } from "@/lib/permissions";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function formatOmr(value: Prisma.Decimal | number | null | undefined) {
  const amount = value instanceof Prisma.Decimal ? value.toNumber() : Number(value ?? 0);
  return new Intl.NumberFormat("en-OM", {
    style: "currency",
    currency: "OMR",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

export default async function GeneralManagerPage() {
  await requirePermission(Permissions.Finance_Read);
  const monthStart = startOfMonth();

  const [globalRevenue, globalDebt, globalCylinderVolume, branches] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: "ISSUED",
        createdAt: { gte: monthStart },
      },
    }),
    prisma.customerDebt.aggregate({
      _sum: { balanceAmount: true },
      where: {
        balanceAmount: { gt: new Prisma.Decimal(0) },
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
      },
    }),
    prisma.invoiceItem.aggregate({
      _sum: { fullCylindersDelivered: true },
      where: {
        invoice: {
          status: "ISSUED",
          createdAt: { gte: monthStart },
        },
      },
    }),
    prisma.branch.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  const branchRows = await Promise.all(
    branches.map(async (branch) => {
      const [activeSalesmen, revenue, debt] = await Promise.all([
        prisma.user.count({
          where: {
            branchId: branch.id,
            role: "SALESMAN",
            isActive: true,
          },
        }),
        prisma.invoice.aggregate({
          _sum: { totalAmount: true },
          where: {
            branchId: branch.id,
            status: "ISSUED",
            createdAt: { gte: monthStart },
          },
        }),
        prisma.customerDebt.aggregate({
          _sum: { balanceAmount: true },
          where: {
            customer: { branchId: branch.id },
            balanceAmount: { gt: new Prisma.Decimal(0) },
            status: { in: ["OPEN", "PARTIALLY_PAID"] },
          },
        }),
      ]);

      const branchDebt = debt._sum.balanceAmount ?? new Prisma.Decimal(0);
      const branchRevenue = revenue._sum.totalAmount ?? new Prisma.Decimal(0);
      const highDebt = branchDebt.greaterThan(new Prisma.Decimal(500));

      return {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        activeSalesmen,
        revenue: branchRevenue,
        debt: branchDebt,
        status: highDebt ? "High Debt" : "Healthy",
      };
    }),
  );

  const kpis = [
    { label: "Global Revenue", value: formatOmr(globalRevenue._sum.totalAmount), tone: "success" as const },
    { label: "Global Outstanding Debt", value: formatOmr(globalDebt._sum.balanceAmount), tone: "danger" as const },
    {
      label: "Global Cylinder Volume",
      value: (globalCylinderVolume._sum.fullCylindersDelivered ?? 0).toLocaleString("en-OM"),
      tone: "default" as const,
    },
  ];

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto flex max-w-screen-xl flex-col gap-6 animate-fade-in">
        <PageHeader
          eyebrow="General Manager"
          title="Global Overview"
          description="National Industrial Gas Plant — Oman. Consolidated performance across every branch."
        />

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {kpis.map((kpi) => (
            <Stat key={kpi.label} label={kpi.label} value={kpi.value} tone={kpi.tone} />
          ))}
        </section>

        <Card className="overflow-hidden p-0">
          <CardHeader title="Branch Performance" description="Monthly revenue, active salesmen and outstanding debt per branch." />
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Branch Name</th>
                  <th>Code</th>
                  <th className="text-right">Active Salesmen</th>
                  <th className="text-right">Monthly Revenue</th>
                  <th className="text-right">Outstanding Debt</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {branchRows.map((branch) => (
                  <tr key={branch.id}>
                    <td className="is-strong">{branch.name}</td>
                    <td className="font-semibold text-slate-600">{branch.code}</td>
                    <td className="num">{branch.activeSalesmen}</td>
                    <td className="num text-emerald-600">{formatOmr(branch.revenue)}</td>
                    <td className="num text-rose-600">{formatOmr(branch.debt)}</td>
                    <td>
                      {branch.status === "High Debt" ? (
                        <Badge tone="danger">High Debt</Badge>
                      ) : (
                        <Badge tone="success">Healthy</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {branchRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center font-bold text-slate-500" colSpan={6}>
                      No branches configured.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}
