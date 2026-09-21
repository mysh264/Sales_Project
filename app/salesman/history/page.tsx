import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateTimeDMY } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function SalesmanHistoryPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== "SALESMAN") {
    redirect("/login");
  }

  const invoices = await prisma.invoice.findMany({
    where: { salesmanId: currentUser.id },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="min-h-screen bg-app-bg p-4 pb-safe md:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 animate-fade-in">
        <PageHeader
          eyebrow="Sales history"
          title={`Invoices by ${currentUser.fullName}`}
          description="Only your own invoices are shown here."
          actions={<ButtonLink href="/salesman" variant="ghost">Back to dashboard</ButtonLink>}
        />

        <section className="ui-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th className="text-right">Total</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="whitespace-nowrap font-bold text-slate-700">
                      {formatDateTimeDMY(invoice.createdAt)}
                    </td>
                    <td>
                      <p className="font-black text-slate-950">{invoice.customer.name}</p>
                      <p className="text-xs font-bold text-slate-500">{invoice.invoiceNumber}</p>
                    </td>
                    <td className="num">{formatMoney(invoice.totalAmount, invoice.currency)}</td>
                    <td>
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <Link href={`/print/${invoice.id}?size=mobile`} className="ui-btn ui-btn-primary ui-btn-sm">
                          Print/View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center font-bold text-slate-500" colSpan={5}>
                      No invoices found.
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
