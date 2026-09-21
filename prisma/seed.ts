import { PrismaClient, UserRole } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_ROLE_PERMISSIONS } from "../lib/permissions";
import { assertSafeTestIdentity, requireTestPassword } from "../lib/test-user-seed";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 }) });
const adminSeedPassword = process.env.SEED_ADMIN_PASSWORD ?? "";
const demoSeedPassword = process.env.SEED_DEMO_PASSWORD ?? "";
const seedDemoUsers = process.env.SEED_DEMO_USERS === "true";
const masterTesterEnabled = process.env.MASTERTESTER_ENABLED === "true";
const masterTesterEmail = process.env.MASTERTESTER_EMAIL ?? "tester@mahmoudbox.com";
const masterTesterPassword = requireTestPassword(
  masterTesterEnabled,
  process.env.MASTERTESTER_PASSWORD,
  "MASTERTESTER_PASSWORD",
);
const testUserPassword = requireTestPassword(
  masterTesterEnabled,
  process.env.TESTER_CANNONICAL_PASSWORD,
  "TESTER_CANNONICAL_PASSWORD",
);

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
    password: adminSeedPassword,
    role: UserRole.ADMIN,
    fullName: "Mahmoud Master Admin",
    phone: "+96890000010",
    needsBranch: false,
  },
  {
    email: "gm@test.local",
    password: demoSeedPassword,
    role: UserRole.GENERAL_MANAGER,
    fullName: "Test General Manager",
    phone: "+96890000017",
    needsBranch: false,
  },
  {
    email: "manager@test.local",
    password: demoSeedPassword,
    role: UserRole.MANAGER,
    fullName: "Test Manager",
    phone: "+96890000012",
    needsBranch: true,
  },
  {
    email: "loader@test.local",
    password: demoSeedPassword,
    role: UserRole.LOADER,
    fullName: "Test Loader",
    phone: "+96890000013",
    needsBranch: true,
  },
  {
    email: "salesman@test.local",
    password: demoSeedPassword,
    role: UserRole.SALESMAN,
    fullName: "Test Salesman",
    phone: "+96890000014",
    needsBranch: true,
  },
  {
    email: "salesman-a@test.local",
    password: demoSeedPassword,
    role: UserRole.SALESMAN,
    fullName: "Test Salesman A",
    phone: "+96890000015",
    needsBranch: true,
    branchCode: "BRANCH_A",
  },
  {
    email: "salesman-b@test.local",
    password: demoSeedPassword,
    role: UserRole.SALESMAN,
    fullName: "Test Salesman B",
    phone: "+968****0016",
    needsBranch: true,
    branchCode: "BRANCH_B",
  },
];

// Canonical test users for the Master Tester feature.
// Only seeded when MASTERTESTER_ENABLED=true. All 11 rows are marked
// isTestUser=true, which is the gate that allows the master tester to
// impersonate them. Real human users (admin, GM, etc.) are never marked,
// so they can never be impersonated regardless of who is asking.
//
// Coverage matrix: 5 roles × 3 branches. ADMIN and GENERAL_MANAGER are
// branch-independent and get assigned SUHAR_MAIN as a default home so
// they appear in the switcher alongside the other roles.
const canonicalTestUsers: Array<{
  email: string;
  role: UserRole;
  fullName: string;
  phone: string;
  branchCode?: string;
}> = [
  { email: "test.admin@mahmoudbox.com",      role: UserRole.ADMIN,            fullName: "Test Admin",                phone: "+968****9001" },
  { email: "test.gm@mahmoudbox.com",         role: UserRole.GENERAL_MANAGER,  fullName: "Test General Manager",      phone: "+968****9002" },
  { email: "test.manager.suhar@mahmoudbox.com", role: UserRole.MANAGER,       fullName: "Test Manager (Suhar Main)", phone: "+968****9003", branchCode: "SUHAR_MAIN" },
  { email: "test.manager.bra@mahmoudbox.com",   role: UserRole.MANAGER,       fullName: "Test Manager (Branch A)",   phone: "+968****9004", branchCode: "BRANCH_A" },
  { email: "test.manager.brb@mahmoudbox.com",   role: UserRole.MANAGER,       fullName: "Test Manager (Branch B)",   phone: "+968****9005", branchCode: "BRANCH_B" },
  { email: "test.loader.suhar@mahmoudbox.com",  role: UserRole.LOADER,        fullName: "Test Loader (Suhar Main)",  phone: "+968****9006", branchCode: "SUHAR_MAIN" },
  { email: "test.loader.bra@mahmoudbox.com",    role: UserRole.LOADER,        fullName: "Test Loader (Branch A)",    phone: "+968****9007", branchCode: "BRANCH_A" },
  { email: "test.loader.brb@mahmoudbox.com",    role: UserRole.LOADER,        fullName: "Test Loader (Branch B)",    phone: "+968****9008", branchCode: "BRANCH_B" },
  { email: "test.salesman.suhar@mahmoudbox.com", role: UserRole.SALESMAN,     fullName: "Test Salesman (Suhar Main)", phone: "+968****9009", branchCode: "SUHAR_MAIN" },
  { email: "test.salesman.bra@mahmoudbox.com",   role: UserRole.SALESMAN,     fullName: "Test Salesman (Branch A)",  phone: "+968****9010", branchCode: "BRANCH_A" },
  { email: "test.salesman.brb@mahmoudbox.com",   role: UserRole.SALESMAN,     fullName: "Test Salesman (Branch B)",  phone: "+968****9011", branchCode: "BRANCH_B" },
];

async function main() {
  if (adminSeedPassword.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must be set to at least 12 characters.");
  }
  if (seedDemoUsers && demoSeedPassword.length < 12) {
    throw new Error("SEED_DEMO_PASSWORD must be set to at least 12 characters when SEED_DEMO_USERS=true.");
  }
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

  const branches = await prisma.branch.findMany({
    orderBy: { code: "asc" },
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
        branchId: null,
        name: item.name,
        gasType: item.gasType,
        cylinderSize: item.cylinderSize,
        pressure: item.pressure,
        isActive: true,
      },
      create: {
        branchId: null,
        sku: item.sku,
        name: item.name,
        gasType: item.gasType,
        cylinderSize: item.cylinderSize,
        pressure: item.pressure,
        unitLabel: "Cylinder",
      },
    });

    for (const targetBranch of branches) {
      const existingRule = await prisma.productPriceRule.findFirst({
        where: { branchId: targetBranch.id, productId: product.id, endsAt: null },
      });

      if (existingRule) {
        await prisma.productPriceRule.update({
          where: { id: existingRule.id },
          data: { currency: "OMR", minPrice: item.minPrice, maxPrice: item.maxPrice },
        });
      } else {
        await prisma.productPriceRule.create({
          data: {
            branchId: targetBranch.id,
            productId: product.id,
            currency: "OMR",
            minPrice: item.minPrice,
            maxPrice: item.maxPrice,
          },
        });
      }
    }

    for (const targetBranch of branches) {
      await prisma.inventoryBalance.upsert({
        where: { branchId_productId: { branchId: targetBranch.id, productId: product.id } },
        update: {},
        create: {
          branchId: targetBranch.id,
          productId: product.id,
          fullCount: 0,
          emptyCount: 0,
        },
      });
    }
  }

  for (const user of seedUsers.filter((entry) => entry.role === UserRole.ADMIN || seedDemoUsers)) {
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

  if (masterTesterEnabled) {
    // The master tester account itself. Only the tester holds
    // Testers_Impersonate; everyone else has zero impersonation rights.
    const existingTester = await prisma.user.findUnique({
      where: { email: masterTesterEmail },
      select: { isTestUser: true },
    });
    assertSafeTestIdentity(existingTester, masterTesterEmail);

    const testerHash = await bcrypt.hash(masterTesterPassword, 12);
    const testerRecord = await prisma.user.upsert({
      where: { email: masterTesterEmail },
      update: {
        fullName: "Master Tester",
        phone: "+968****0000",
        role: UserRole.TESTER,
        roleId: roleRecords[UserRole.TESTER],
        isActive: true,
        isTestUser: true,
        allowGlobalSalesView: false,
        passwordHash: testerHash,
        branchId: branch.id,
      },
      create: {
        email: masterTesterEmail,
        fullName: "Master Tester",
        phone: "+968****0000",
        role: UserRole.TESTER,
        roleId: roleRecords[UserRole.TESTER],
        isTestUser: true,
        isActive: true,
        allowGlobalSalesView: false,
        passwordHash: testerHash,
        branchId: branch.id, // SUHAR_MAIN; the tester is branch-independent
      },
    });
    console.info(JSON.stringify({
      event: "seed.master_tester.upserted",
      id: testerRecord.id,
      email: masterTesterEmail,
    }));

    // The 11 canonical test users (one per role+branch). All marked
    // isTestUser=true so the impersonation gate accepts them.
    const canonHash = await bcrypt.hash(testUserPassword, 12);
    for (const t of canonicalTestUsers) {
      const targetBranch = t.branchCode === "BRANCH_A"
        ? branchA
        : t.branchCode === "BRANCH_B"
        ? branchB
        : branch; // SUHAR_MAIN default for branch-independent roles
      const existingCanonicalUser = await prisma.user.findUnique({
        where: { email: t.email },
        select: { isTestUser: true },
      });
      assertSafeTestIdentity(existingCanonicalUser, t.email);

      await prisma.user.upsert({
        where: { email: t.email },
        update: {
          isTestUser: true,
          isActive: true,
          passwordHash: canonHash,
          branchId: targetBranch.id,
          role: t.role,
          roleId: roleRecords[t.role],
          fullName: t.fullName,
          phone: t.phone,
          allowGlobalSalesView: false,
        },
        create: {
          email: t.email,
          fullName: t.fullName,
          phone: t.phone,
          role: t.role,
          roleId: roleRecords[t.role],
          isTestUser: true,
          isActive: true,
          allowGlobalSalesView: false,
          passwordHash: canonHash,
          branchId: targetBranch.id,
        },
      });
    }
    console.info(JSON.stringify({
      event: "seed.canonical_test_users.upserted",
      count: canonicalTestUsers.length,
    }));
  }

  console.log(
    `Seed complete: master data and admin account are ready${seedDemoUsers ? " with demo users" : ""}${masterTesterEnabled ? ` + master tester (${masterTesterEmail}) + ${canonicalTestUsers.length} canonical test users` : ""}.`,
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
