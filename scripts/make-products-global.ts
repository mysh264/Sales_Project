import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany({ orderBy: { code: "asc" } });
  const products = await prisma.product.findMany({
    include: {
      priceRules: {
        where: { endsAt: null },
        orderBy: { startsAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  let updatedProducts = 0;
  let ensuredRules = 0;
  const defaultCurrency = "OMR";
  const defaultMin = "0.000";
  const defaultMax = "9999.999";

  for (const product of products) {
    const templateRule = product.priceRules[0];

    await prisma.$transaction(async (tx) => {
      if (product.branchId !== null) {
        updatedProducts += 1;
      }

      await tx.product.update({
        where: { id: product.id },
        data: { branchId: null },
      });

      const sourceRule = templateRule
        ? {
            currency: templateRule.currency,
            minPrice: templateRule.minPrice,
            maxPrice: templateRule.maxPrice,
          }
        : {
            currency: defaultCurrency,
            minPrice: defaultMin,
            maxPrice: defaultMax,
          };

      for (const branch of branches) {
        const existing = await tx.productPriceRule.findFirst({
          where: {
            branchId: branch.id,
            productId: product.id,
            endsAt: null,
          },
        });

        if (existing) {
          await tx.productPriceRule.update({
            where: { id: existing.id },
            data: {
              currency: sourceRule.currency,
              minPrice: sourceRule.minPrice,
              maxPrice: sourceRule.maxPrice,
            },
          });
        } else {
          await tx.productPriceRule.create({
            data: {
              branchId: branch.id,
              productId: product.id,
              currency: sourceRule.currency,
              minPrice: sourceRule.minPrice,
              maxPrice: sourceRule.maxPrice,
            },
          });
        }

        ensuredRules += 1;
      }
    });
  }

  console.log(
    JSON.stringify(
      {
        productsSeen: products.length,
        branchesSeen: branches.length,
        ensuredRules,
        updatedProducts,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
