import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permission-guard";
import { Permissions } from "@/lib/permissions";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { Donut, BarList, Trend, KpiCallout } from "@/components/ui/Chart";
import { formatOmr } from "@/lib/money";

export const dynamic = "force-dynamic";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function lastSixMonths() {
  const now = new Date();
  const months: { start: Date; end: Date; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push({
      start: d,
      end,
      label: d.toLocaleDateString("en-OM", { month: "short" }),
    });
  }
  return months;
}

export default async function GeneralManagerPage() {
  await requirePermission(Permissions.Finance_Read);
  const monthStart = startOfMonth();
  const months = lastSixMonths();

  const [globalRevenue, globalDebt, globalCylinderVolume, , monthlyRevenue, topBranches] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: { status: "ISSUED", createdAt: { gte: monthStart } },
    }),
    prisma.customerDebt.aggregate({
      _sum: { balanceAmount: true },
      where: { balanceAmount: { gt: new Prisma.Decimal(0) }, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
    }),
    prisma.invoiceItem.aggregate({
      _sum: { fullCylindersDelivered: true },
      where: { invoice: { status: "ISSUED", createdAt: { gte: monthStart } } },
    }),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    Promise.all(
      months.map((m) =>
        prisma.invoice.aggregate({
          _sum: { totalAmount: true },
          where: { status: "ISSUED", createdAt: { gte: m.start, lt: m.end } },
        }),
      ),
    ),
    prisma.branch.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  const branchRows = await Promise.all(
    topBranches.map(async (branch) => {
      const [activeSalesmen, revenue, debt] = await Promise.all([
        prisma.user.count({ where: { branchId: branch.id, role: "SALESMAN", isActive: true } }),
        prisma.invoice.aggregate({
          _sum: { totalAmount: true },
          where: { branchId: branch.id, status: "ISSUED", createdAt: { gte: monthStart } },
        }),
        prisma.customerDebt.aggregate({
          _sum: { balanceAmount: true },
          where: { customer: { branchId: branch.id }, balanceAmount: { gt: new Prisma.Decimal(0) }, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
        }),
      ]);
      const branchDebt = debt._sum.balanceAmount ?? new Prisma.Decimal(0);
      const branchRevenue = revenue._sum.totalAmount ?? new Prisma.Decimal(0);
      return {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        activeSalesmen,
        revenue: branchRevenue,
        debt: branchDebt,
        status: branchDebt.greaterThan(new Prisma.Decimal(500)) ? "High Debt" : "Healthy",
      };
    }),
  );

  const totalRevenue = globalRevenue._sum.totalAmount ?? new Prisma.Decimal(0);
  const totalDebt = globalDebt._sum.balanceAmount ?? new Prisma.Decimal(0);

  const kpis = [
    { label: "Global Revenue (MTD)", value: formatOmr(totalRevenue), tone: "success" as const },
    { label: "Global Outstanding Debt", value: formatOmr(totalDebt), tone: "danger" as const },
    {
      label: "Global Cylinder Volume (MTD)",
      value: (globalCylinderVolume._sum.fullCylindersDelivered ?? 0).toLocaleString("en-OM"),
      tone: "default" as const,
    },
  ];

  const trendPoints = monthlyRevenue.map((m) => Number(m._sum.totalAmount ?? 0));
  const barItems = branchRows
    .map((b) => ({ label: b.name, value: Number(b.revenue), sublabel: `${b.activeSalesmen} active salesmen` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Revenue vs Outstanding Debt" description="Composition of this month's invoiced revenue against unpaid debt." />
            <Donut
              segments={[
                { label: "Revenue", value: Number(totalRevenue), color: "#10b981" },
                { label: "Outstanding Debt", value: Number(totalDebt), color: "#f43f5e" },
              ]}
              centerValue={formatOmr(totalRevenue)}
              centerLabel="MTD Revenue"
            />
          </Card>

          <Card>
            <CardHeader title="6-Month Revenue Trend" description="Issued invoice revenue per month (OMR)." />
            <KpiCallout>
              <Trend points={trendPoints} labels={months.map((m) => m.label)} height={72} />
              <p className="mt-2 text-right text-sm font-bold text-emerald-600">
                {formatOmr(trendPoints.reduce((a, b) => a + b, 0))} last 6 months
              </p>
            </KpiCallout>
          </Card>
        </div>

        <Card>
          <CardHeader title="Revenue by Branch" description="Top branches by invoiced revenue this month." />
          <BarList items={barItems} formatValue={(v) => formatOmr(v)} tone="brand" />
        </Card>

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
