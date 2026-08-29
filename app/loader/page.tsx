import Link from "next/link";
import { SalesmanHandoffPicker } from "./SalesmanHandoffPicker";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasGlobalSalesAccess } from "@/lib/session";
import { businessDate } from "@/lib/business-date";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { StatusBadge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

function startOfDay() {
  return businessDate();
}

export default async function LoaderDashboardPage() {
  const currentUser = await getCurrentUser();
  const dayStart = startOfDay();
  const hasGlobalAccess = hasGlobalSalesAccess(currentUser);
  const branchFilter = hasGlobalAccess ? {} : currentUser?.branchId ? { branchId: currentUser.branchId } : { branchId: "__no_branch__" };

  const [salesmen, reconciliations] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SALESMAN", isActive: true, ...branchFilter },
      include: {
        salesmanReconciliations: {
          where: { reconciliationDate: dayStart },
          include: { items: true },
          orderBy: { morningLoggedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.dailyReconciliation.findMany({
      where: {
        reconciliationDate: dayStart,
        ...(hasGlobalAccess ? {} : currentUser?.branchId ? { branchId: currentUser.branchId } : { branchId: "__no_branch__" }),
      },
      include: {
        items: true,
      },
    }),
  ]);

  const todaysLoads = reconciliations.length;
  const pendingReturns = reconciliations.filter((item) => item.status !== "EVENING_RECONCILED").length;

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 animate-fade-in">
        <PageHeader
          eyebrow="Loader / Unloader"
          title="Daily Route Dashboard"
          description="Select a salesman, record the hand-off, and close the route at the end of the day."
          actions={
            <>
              <ButtonLink href="/loader" variant="ghost">Home</ButtonLink>
              <ButtonLink href="/logistics/reconciliation" variant="ghost">Reconciliation</ButtonLink>
            </>
          }
        />

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Stat label="Today's Loads" value={todaysLoads} hint="Morning load hand-offs recorded today." />
          <Stat label="Pending Returns" value={pendingReturns} tone="warning" hint="Routes still waiting for evening close-out." />
        </section>

        <SalesmanHandoffPicker
          salesmen={salesmen.map((salesman) => ({
            id: salesman.id,
            fullName: salesman.fullName,
          }))}
        />

        <Card className="overflow-hidden p-0">
          <CardHeader title="Salesman Queue" description="Waiting and on-route salesmen for quick hand-off." />
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Salesman</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {salesmen.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center font-bold text-slate-500" colSpan={3}>
                      No active salesmen are available.
                    </td>
                  </tr>
                ) : (
                  salesmen.map((salesman) => {
                    const route = salesman.salesmanReconciliations[0] ?? null;
                    const isOnRoute = Boolean(route && route.status !== "EVENING_RECONCILED");

                    return (
                      <tr key={salesman.id}>
                        <td className="is-strong">{salesman.fullName}</td>
                        <td>
                          <StatusBadge status={isOnRoute ? "ON_ROUTE" : "WAITING"} />
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/loader/load/${salesman.id}`}
                              className="ui-btn ui-btn-success ui-btn-sm"
                            >
                              Morning Load
                            </Link>
                            <Link
                              href={`/loader/return/${salesman.id}`}
                              className="ui-btn ui-btn-ghost ui-btn-sm"
                            >
                              Evening Return
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}
