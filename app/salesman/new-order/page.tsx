import { redirect } from "next/navigation";
import { createOrder } from "@/app/actions/sales";
import { searchCustomers } from "@/app/actions/customer-search";
import { buildInvoiceSerial } from "@/lib/invoice";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { NewInvoiceForm } from "./NewInvoiceForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

type NewOrderPageProps = {
  searchParams?: Promise<{
    error?: string;
    customerId?: string;
  }>;
};

export default async function NewOrderPage({ searchParams }: NewOrderPageProps) {
  const salesman = await getCurrentUser();

  if (!salesman || salesman.role !== "SALESMAN" || !salesman.branch) {
    redirect("/login");
  }
  const branchId = salesman.branchId;

  if (!branchId) {
    redirect("/login");
  }

  const customerWhere = { branchId };
  const debtWhere = {
    balanceAmount: { gt: 0 },
    customer: { branchId },
  };
  const priceRuleNow = new Date();

  const [customers, products, customerDebtRows] = await Promise.all([
    prisma.customer.findMany({
      where: customerWhere,
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      include: {
        priceRules: {
          orderBy: { startsAt: "desc" },
          where: {
            branchId,
            startsAt: { lte: priceRuleNow },
            OR: [{ endsAt: null }, { endsAt: { gt: priceRuleNow } }],
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.customerDebt.findMany({
      where: debtWhere,
      select: {
        customerId: true,
        balanceAmount: true,
        invoice: { select: { currency: true } },
      },
    }),
  ]);

  const productData = products.map((product) => ({
    id: product.id,
    name: product.name,
    cylinderSize: product.cylinderSize,
    pressure: product.pressure,
    prices: product.priceRules.reduce<Record<string, { minPrice: string; maxPrice: string; defaultPrice: string }>>(
      (prices, rule) => {
        if (!prices[rule.currency]) {
          prices[rule.currency] = {
            minPrice: rule.minPrice.toFixed(3),
            maxPrice: rule.maxPrice.toFixed(3),
            defaultPrice: rule.minPrice.toFixed(3),
          };
        }
        return prices;
      },
      {},
    ),
  }));

  const customerData = customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone ?? "",
    address: customer.address ?? "",
    vatNumber: customer.vatNumber ?? "",
  }));
  const customerCreditBalances = Object.fromEntries(
    customers.map((customer) => [customer.id, customer.creditBalance.toFixed(3)]),
  );

  const customerDebtBalances = customerDebtRows.reduce<Record<string, Record<string, string>>>((accumulator, debt) => {
    const balancesByCurrency = accumulator[debt.customerId] ?? {};
    const current = Number.parseFloat(balancesByCurrency[debt.invoice.currency] ?? "0");
    const next = current + debt.balanceAmount.toNumber();
    balancesByCurrency[debt.invoice.currency] = next.toFixed(3);
    accumulator[debt.customerId] = balancesByCurrency;
    return accumulator;
  }, {});

  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessage = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : "";
  const initialCustomerId =
    typeof resolvedSearchParams.customerId === "string" ? resolvedSearchParams.customerId : undefined;
  const defaultTaxRate = salesman.branch.defaultTaxRate.toString();
  const invoiceSerial = buildInvoiceSerial();

  return (
    <main className="min-h-screen bg-app-bg p-3 md:p-6">
      <div className="mx-auto max-w-6xl animate-fade-in">
        <PageHeader
          eyebrow={`${salesman.branch.name} · ${salesman.branch.defaultCurrency}`}
          title="New Cylinder Order"
          description={`Invoice ${invoiceSerial} — create a customer invoice with live pricing.`}
        />
        <NewInvoiceForm
          salesmanName={salesman.fullName}
          branchName={salesman.branch.name}
          defaultCurrency={salesman.branch.defaultCurrency}
          defaultTaxRate={defaultTaxRate}
          invoiceSerial={invoiceSerial}
          action={createOrder}
          customers={customerData}
          products={productData}
          customerDebtBalances={customerDebtBalances}
          customerCreditBalances={customerCreditBalances}
          searchCustomersAction={searchCustomers}
          errorMessage={errorMessage}
          initialCustomerId={initialCustomerId}
        />
      </div>
    </main>
  );
}
