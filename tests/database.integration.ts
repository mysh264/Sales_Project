import assert from "node:assert/strict";
import test, { after } from "node:test";
import { PrismaClient, UserRole } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 }) });
after(async () => prisma.$disconnect());

test("all supported account types are seeded and active", async () => {
  const rows = await prisma.user.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true } });
  const roles = new Set(rows.map((row) => row.role));
  for (const role of Object.values(UserRole)) {
    assert.equal(roles.has(role), true, `missing active ${role} account`);
  }
});

test("every branch/product pair has an inventory balance", async () => {
  const [branchCount, productCount, balanceCount] = await Promise.all([
    prisma.branch.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.inventoryBalance.count(),
  ]);
  assert.equal(balanceCount, branchCount * productCount);
});

test("truck tables are absent from the deployed schema", async () => {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('Truck', 'TruckLoadSession', 'TruckLoadItem', 'TruckReturnItem')
  `;
  assert.deepEqual(rows, []);
});

test("session revocation and login protection fields stay in valid ranges", async () => {
  const users = await prisma.user.findMany({
    select: { sessionVersion: true, failedLoginAttempts: true, lockedUntil: true },
  });
  assert.ok(users.length > 0);
  for (const user of users) {
    assert.ok(Number.isInteger(user.sessionVersion) && user.sessionVersion >= 1);
    assert.ok(Number.isInteger(user.failedLoginAttempts) && user.failedLoginAttempts >= 0);
    assert.ok(user.lockedUntil === null || user.lockedUntil instanceof Date);
  }
});

test("branch workflow accounts are connected to the same operational scope", async () => {
  const accounts = await prisma.user.findMany({
    where: { email: { in: ["manager@test.local", "loader@test.local", "salesman@test.local"] } },
    select: { email: true, role: true, branchId: true, isActive: true },
  });
  assert.equal(accounts.length, 3);
  assert.ok(accounts.every((account) => account.isActive));
  assert.ok(accounts.every((account) => account.branchId));
  assert.equal(new Set(accounts.map((account) => account.branchId)).size, 1);
  assert.deepEqual(new Set(accounts.map((account) => account.role)), new Set(["MANAGER", "LOADER", "SALESMAN"]));
});
