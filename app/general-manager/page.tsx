import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
    {
      label: "Global Revenue",
      value: formatOmr(globalRevenue._sum.totalAmount),
      tone: "text-green-700",
    },
    {
      label: "Global Outstanding Debt",
      value: formatOmr(globalDebt._sum.balanceAmount),
      tone: "text-red-700",
    },
    {
      label: "Global Cylinder Volume",
      value: (globalCylinderVolume._sum.fullCylindersDelivered ?? 0).toLocaleString("en-OM"),
      tone: "text-slate-950",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto flex max-w-screen-xl flex-col gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-slate-500">General Manager</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950 md:text-4xl">
            NATIONAL INDUSTRIAL GAS PLANT - OMAN - Global Overview
          </h1>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {kpis.map((kpi) => (
            <article key={kpi.label} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">{kpi.label}</p>
              <p className={`mt-3 text-4xl font-black ${kpi.tone}`}>{kpi.value}</p>
            </article>
          ))}
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black text-slate-950">Branch Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">Branch Name</th>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2 text-right">Active Salesmen</th>
                  <th className="px-4 py-2 text-right">Monthly Revenue</th>
                  <th className="px-4 py-2 text-right">Outstanding Debt</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {branchRows.map((branch) => (
                  <tr key={branch.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2 font-black text-slate-950">{branch.name}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-bold text-slate-600">{branch.code}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-bold text-slate-900">
                      {branch.activeSalesmen}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-bold text-green-700">
                      {formatOmr(branch.revenue)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-bold text-red-700">
                      {formatOmr(branch.debt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-black uppercase ${
                          branch.status === "High Debt" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                        }`}
                      >
                        {branch.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {branchRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-center font-bold text-slate-500" colSpan={6}>
                      No branches configured.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

