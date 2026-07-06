import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: [
    "INVOICE_CREATE",
    "INVENTORY_UPDATE",
    "CUSTOMER_MANAGE",
    "PRODUCT_MANAGE",
    "PRICE_RULE_UPDATE",
    "DEBT_COLLECT",
    "FINANCE_VIEW",
    "LOGISTICS_EXECUTE",
    "USER_MANAGE",
    "ROLE_MANAGE",
    "AUDIT_VIEW",
    "AUDIT_DELETE",
    "MANAGER_VIEW_ALL_SALES",
  ],
  GENERAL_MANAGER: [
    "INVOICE_CREATE",
    "INVENTORY_UPDATE",
    "CUSTOMER_MANAGE",
    "PRODUCT_MANAGE",
    "PRICE_RULE_UPDATE",
    "DEBT_COLLECT",
    "FINANCE_VIEW",
    "USER_MANAGE",
    "ROLE_MANAGE",
    "AUDIT_VIEW",
    "MANAGER_VIEW_ALL_SALES",
  ],
  MANAGER: [
    "INVOICE_CREATE",
    "INVENTORY_UPDATE",
    "CUSTOMER_MANAGE",
    "PRODUCT_MANAGE",
    "DEBT_COLLECT",
    "FINANCE_VIEW",
    "AUDIT_VIEW",
    "MANAGER_VIEW_ALL_SALES",
  ],
  ACCOUNTANT: ["DEBT_COLLECT", "PRICE_RULE_UPDATE", "AUDIT_VIEW", "FINANCE_VIEW"],
  ACCOUNTANT_MANAGER: ["DEBT_COLLECT", "PRICE_RULE_UPDATE", "AUDIT_VIEW", "USER_MANAGE", "FINANCE_VIEW"],
  LOADER: ["INVENTORY_UPDATE", "LOGISTICS_EXECUTE"],
  SALESMAN: ["INVOICE_CREATE", "CUSTOMER_MANAGE"],
};

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
  {
    sku: "ARG-40L-150BAR",
    name: "Argon",
    gasType: "Argon",
    cylinderSize: "40L",
    pressure: "150Bar",
    minPrice: "3.000",
    maxPrice: "4.500",
  },
  {
    sku: "NIT-40L-150BAR",
    name: "Nitrogen",
    gasType: "Nitrogen",
    cylinderSize: "40L",
    pressure: "150Bar",
    minPrice: "2.200",
    maxPrice: "3.500",
  },
  {
    sku: "CO2-20KG",
    name: "CO2",
    gasType: "Carbon Dioxide",
    cylinderSize: "20Kg",
    pressure: null,
    minPrice: "1.000",
    maxPrice: "2.400",
  },
  {
    sku: "CO2-30KG",
    name: "CO2",
    gasType: "Carbon Dioxide",
    cylinderSize: "30Kg",
    pressure: null,
    minPrice: "1.500",
    maxPrice: "3.000",
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
  {
    email: "salesman-a@test.local",
    password: "Pass123!",
    role: UserRole.SALESMAN,
    fullName: "Test Salesman A",
    phone: "+96890000015",
    needsBranch: true,
    branchCode: "BRANCH_A",
  },
  {
    email: "salesman-b@test.local",
    password: "Pass123!",
    role: UserRole.SALESMAN,
    fullName: "Test Salesman B",
    phone: "+96890000016",
    needsBranch: true,
    branchCode: "BRANCH_B",
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
      defaultTaxRate: "5.0000",
    },
    create: {
      companyId: company.id,
      code: "SUHAR_MAIN",
      name: "Suhar Main Branch",
      defaultCurrency: "OMR",
      defaultPhoneCode: "+968",
      defaultTaxRate: "5.0000",
    },
  });

  const branchA = await prisma.branch.upsert({
    where: { code: "BRANCH_A" },
    update: {
      companyId: company.id,
      name: "Branch A",
      location: "North Warehouse",
      defaultCurrency: "OMR",
      defaultPhoneCode: "+968",
      defaultTaxRate: "5.0000",
    },
    create: {
      companyId: company.id,
      code: "BRANCH_A",
      name: "Branch A",
      location: "North Warehouse",
      defaultCurrency: "OMR",
      defaultPhoneCode: "+968",
      defaultTaxRate: "5.0000",
    },
  });

  const branchB = await prisma.branch.upsert({
    where: { code: "BRANCH_B" },
    update: {
      companyId: company.id,
      name: "Branch B",
      location: "South Warehouse",
      defaultCurrency: "OMR",
      defaultPhoneCode: "+968",
      defaultTaxRate: "5.0000",
    },
    create: {
      companyId: company.id,
      code: "BRANCH_B",
      name: "Branch B",
      location: "South Warehouse",
      defaultCurrency: "OMR",
      defaultPhoneCode: "+968",
      defaultTaxRate: "5.0000",
    },
  });

  const roleRecords: Record<UserRole, string> = {} as Record<UserRole, string>;

  for (const role of Object.values(UserRole)) {
    const record = await prisma.role.upsert({
      where: { name: role },
      update: {
        permissions: DEFAULT_ROLE_PERMISSIONS[role],
      },
      create: {
        name: role,
        permissions: DEFAULT_ROLE_PERMISSIONS[role],
      },
    });

    roleRecords[role] = record.id;
  }

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
    const targetBranch = user.branchCode === "BRANCH_A" ? branchA : user.branchCode === "BRANCH_B" ? branchB : user.needsBranch ? branch : null;

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        branchId: targetBranch?.id ?? null,
        role: user.role,
        roleId: roleRecords[user.role],
        fullName: user.fullName,
        phone: user.phone,
        isActive: true,
        allowGlobalSalesView: false,
        passwordHash,
      },
      create: {
        branchId: targetBranch?.id ?? null,
        role: user.role,
        roleId: roleRecords[user.role],
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        passwordHash,
        allowGlobalSalesView: false,
      },
    });
  }

  console.log(
    "Seed complete: company, branch, products, price rules, inventory balances, roles, and role test accounts are ready.",
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
