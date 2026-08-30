import { PrismaClient, UserRole } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

// Idempotent first-boot bootstrap. The main seed (prisma/seed.ts) is the source of truth for
// master data, but it is not always run in every deployment. This guard ensures an ADMIN
// account always exists so operators are never locked out of a fresh database.

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 }) });

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@mahmoudbox.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      "SEED_ADMIN_PASSWORD must be set to at least 12 characters to bootstrap the admin account.",
    );
  }

  const existing = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  if (!existing) {
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        fullName: process.env.SEED_ADMIN_NAME || "System Administrator",
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
        hasGlobalAccess: true,
        allowGlobalSalesView: true,
      },
    });
    console.info(JSON.stringify({ event: "bootstrap.admin.created", id: admin.id, email: adminEmail }));
    return;
  }

  // Idempotent sync: keep the admin's password aligned with SEED_ADMIN_PASSWORD on every
  // boot so operators are never locked out after rotating the env secret. Only rewrite the
  // hash when it actually differs (avoids needless password churn / audit noise). We update
  // by primary key and never write `email`, so a stray duplicate ADMIN row elsewhere can't
  // trigger a unique-email constraint violation and crash startup.
  if (existing.passwordHash !== passwordHash) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, isActive: true },
    });
    console.info(JSON.stringify({ event: "bootstrap.admin.password_synced", id: existing.id, email: adminEmail }));
  } else {
    console.info(JSON.stringify({ event: "bootstrap.admin.skip", reason: "admin_exists", adminCount: 1 }));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
