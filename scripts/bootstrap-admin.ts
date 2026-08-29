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
  const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
  if (adminCount > 0) {
    console.info(JSON.stringify({ event: "bootstrap.admin.skip", reason: "admin_exists", adminCount }));
    return;
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@mahmoudbox.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      "SEED_ADMIN_PASSWORD must be set to at least 12 characters to bootstrap the admin account.",
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
