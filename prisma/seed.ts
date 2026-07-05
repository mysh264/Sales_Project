import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const companyData = {
  name: "NATIONAL INDUSTRIAL GAS PLANT - OMAN",
  address: "Suhar Industrial City Phase 7, P.O.Box 1195 Zip Code 311",
  vatNumber: "0M1100407450",
};

const products = [
  {
    sku: "OXY-40L-150BAR",
    name: "Oxygen",
    gasType: "Oxygen",
    cylinderSize: "40L",
    pressure: "150Bar",
    minPrice: "1.200",
    maxPrice: "2.000",
  },
  {
    sku: "ACE-3KG",
    name: "Acetylene",
    gasType: "Acetylene",
    cylinderSize: "3Kg",
    pressure: null,
    minPrice: "6.000",
    maxPrice: "8.500",
  },
  {
    sku: "ARG-50L-200BAR",
    name: "Argon",
    gasType: "Argon",
    cylinderSize: "50L",
    pressure: "200Bar",
    minPrice: "3.500",
    maxPrice: "5.000",
  },
];

const seedUsers = [
  {
    email: "admin@mahmoudbox.com",
    password: "SuperSecure123!",
    role: UserRole.ADMIN,
    fullName: "Mahmoud Master Admin",
    phone: "+96890000010",
    needsBranch: false,
  },
  {
    email: "accountant@test.local",
    password: "Pass123!",
    role: UserRole.ACCOUNTANT,
    fullName: "Test Accountant",
    phone: "+96890000011",
    needsBranch: true,
  },
  {
    email: "manager@test.local",
    password: "Pass123!",
    role: UserRole.MANAGER,
    fullName: "Test Manager",
    phone: "+96890000012",
    needsBranch: true,
  },
  {
    email: "loader@test.local",
    password: "Pass123!",
    role: UserRole.LOADER,
    fullName: "Test Loader",
    phone: "+96890000013",
    needsBranch: true,
  },
  {
    email: "salesman@test.local",
    password: "Pass123!",
    role: UserRole.SALESMAN,
    fullName: "Test Salesman",
    phone: "+96890000014",
    needsBranch: true,
  },
];

async function main() {
  const company =
    (await prisma.company.findFirst({ where: { vatNumber: companyData.vatNumber } })) ??
    (await prisma.company.create({ data: companyData }));

  const branch = await prisma.branch.upsert({
    where: { code: "SUHAR_MAIN" },
    update: {
      companyId: company.id,
      name: "Suhar Main Branch",
      defaultCurrency: "OMR",
      defaultPhoneCode: "+968",
      defaultTaxRate: "0.0000",
    },
    create: {
      companyId: company.id,
      code: "SUHAR_MAIN",
      name: "Suhar Main Branch",
      defaultCurrency: "OMR",
      defaultPhoneCode: "+968",
      defaultTaxRate: "0.0000",
    },
  });

  for (const item of products) {
    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      update: {
        branchId: branch.id,
        name: item.name,
        gasType: item.gasType,
        cylinderSize: item.cylinderSize,
        pressure: item.pressure,
        isActive: true,
      },
      create: {
        branchId: branch.id,
        sku: item.sku,
        name: item.name,
        gasType: item.gasType,
        cylinderSize: item.cylinderSize,
        pressure: item.pressure,
        unitLabel: "Cylinder",
      },
    });

    const existingRule = await prisma.productPriceRule.findFirst({
      where: { branchId: branch.id, productId: product.id, endsAt: null },
    });

    if (existingRule) {
      await prisma.productPriceRule.update({
        where: { id: existingRule.id },
        data: { currency: "OMR", minPrice: item.minPrice, maxPrice: item.maxPrice },
      });
    } else {
      await prisma.productPriceRule.create({
        data: {
          branchId: branch.id,
          productId: product.id,
          currency: "OMR",
          minPrice: item.minPrice,
          maxPrice: item.maxPrice,
        },
      });
    }

    await prisma.inventoryBalance.upsert({
      where: { branchId_productId: { branchId: branch.id, productId: product.id } },
      update: {},
      create: {
        branchId: branch.id,
        productId: product.id,
        fullCount: 0,
        emptyCount: 0,
      },
    });
  }

  for (const user of seedUsers) {
    const passwordHash = await bcrypt.hash(user.password, 12);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        branchId: user.needsBranch ? branch.id : null,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone,
        isActive: true,
        allowGlobalSalesView: false,
        passwordHash,
      },
      create: {
        branchId: user.needsBranch ? branch.id : null,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        passwordHash,
        allowGlobalSalesView: false,
      },
    });
  }

  console.log("Seed complete: company, branch, products, price rules, inventory balances, and role test accounts are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
