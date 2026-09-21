import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isInvoiceBalanced, toDecimal } from "@/lib/money";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      totalAmount: true,
      paidAmount: true,
      writtenOffAmount: true,
      debtAmount: true,
    },
  });

  const violations: { id: string; invoiceNumber: string; status: string; diff: string }[] = [];
  for (const inv of invoices) {
    if (!isInvoiceBalanced(inv)) {
      const total = toDecimal(inv.totalAmount);
      const paid = toDecimal(inv.paidAmount);
      const writtenOff = toDecimal(inv.writtenOffAmount);
      const debt = toDecimal(inv.debtAmount);
      const diff = total.sub(paid.add(debt).add(writtenOff)).abs().toFixed(3);
      violations.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        diff,
      });
    }
  }

  if (violations.length === 0) {
    console.info(
      JSON.stringify({ event: "financial-invariant.ok", checked: invoices.length, violations: 0 }),
    );
    return;
  }

  console.warn(
    JSON.stringify({ event: "financial-invariant.VIOLATIONS", checked: invoices.length, violations }, null, 2),
  );
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("ERR", e);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
