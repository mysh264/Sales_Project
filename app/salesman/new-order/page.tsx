import { redirect } from "next/navigation";
import { createOrder } from "@/app/actions/sales";
import { buildInvoiceSerial } from "@/lib/invoice";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasGlobalSalesAccess } from "@/lib/session";
import { NewInvoiceForm } from "./NewInvoiceForm";

export const dynamic = "force-dynamic";

type NewOrderPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function NewOrderPage({ searchParams }: NewOrderPageProps) {
  const salesman = await getCurrentUser();

  if (!salesman || salesman.role !== "SALESMAN" || !salesman.branch) {
    redirect("/login");
  }
  const branchId = salesman.branchId;
  const hasGlobalAccess = hasGlobalSalesAccess(salesman);

  if (!branchId) {
    redirect("/login");
  }

  const customerWhere = hasGlobalAccess ? {} : { branchId };
  const debtWhere = hasGlobalAccess
    ? { balanceAmount: { gt: 0 } }
    : {
        balanceAmount: { gt: 0 },
        customer: { branchId },
      };

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
          where: { endsAt: null },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.customerDebt.findMany({
      where: debtWhere,
      select: {
        customerId: true,
        balanceAmount: true,
      },
    }),
  ]);

  const productData = products.map((product) => ({
    id: product.id,
    name: product.name,
    cylinderSize: product.cylinderSize,
    pressure: product.pressure,
    minPrice:
      product.priceRules.find((rule) => rule.branchId === branchId)?.minPrice.toFixed(3) ??
      product.priceRules[0]?.minPrice.toFixed(3) ??
      "0.000",
    maxPrice:
      product.priceRules.find((rule) => rule.branchId === branchId)?.maxPrice.toFixed(3) ??
      product.priceRules[0]?.maxPrice.toFixed(3) ??
      "0.000",
    defaultPrice:
      product.priceRules.find((rule) => rule.branchId === branchId)?.minPrice.toFixed(3) ??
      product.priceRules[0]?.minPrice.toFixed(3) ??
      "0.000",
  }));

  const customerData = customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone ?? "",
    address: customer.address ?? "",
    vatNumber: customer.vatNumber ?? "",
  }));

  const customerDebtBalances = customerDebtRows.reduce<Record<string, string>>((accumulator, debt) => {
    const current = Number.parseFloat(accumulator[debt.customerId] ?? "0");
    const next = current + debt.balanceAmount.toNumber();
    accumulator[debt.customerId] = next.toFixed(3);
    return accumulator;
  }, {});

  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessage = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : "";
  const defaultTaxRate = salesman.branch.defaultTaxRate.toNumber() > 0
    ? Math.round(salesman.branch.defaultTaxRate.toNumber()).toString()
    : "5";

  return (
    <main className="min-h-screen bg-gray-50 px-3 py-4 md:px-6 md:py-6">
      <NewInvoiceForm
        salesmanName={salesman.fullName}
        branchName={salesman.branch.name}
        defaultCurrency={salesman.branch.defaultCurrency}
        defaultTaxRate={defaultTaxRate}
        invoiceSerial={buildInvoiceSerial()}
        action={createOrder}
        customers={customerData}
        products={productData}
        customerDebtBalances={customerDebtBalances}
        errorMessage={errorMessage}
      />
    </main>
  );
}
