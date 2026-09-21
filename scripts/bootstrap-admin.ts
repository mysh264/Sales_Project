import { PrismaClient, UserRole } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { bootstrapPasswordNeedsSync } from "@/lib/bootstrap-admin";
import { ensureBootstrapCompany } from "@/lib/bootstrap-company";

// Idempotent first-boot bootstrap. The main seed (prisma/seed.ts) is the source of truth for
// master data, but it is not always run in every deployment. This guard ensures an ADMIN
// account and Company record always exist so operators can configure a fresh database.

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

  await ensureBootstrapCompany(prisma);

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existing) {
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
    return;
  }

  if (existing.role !== UserRole.ADMIN || existing.isTestUser) {
    throw new Error(`SEED_ADMIN_EMAIL is already used by a non-bootstrap account: ${adminEmail}`);
  }

  // Idempotent sync: keep the admin's password aligned with SEED_ADMIN_PASSWORD on every
  // boot so operators are never locked out after rotating the env secret. bcrypt hashes are
  // salted, so compare the plaintext against the stored hash instead of comparing two hashes.
  const passwordNeedsSync = await bootstrapPasswordNeedsSync(adminPassword, existing.passwordHash);
  const accountNeedsSync = !existing.isActive || !existing.hasGlobalAccess || !existing.allowGlobalSalesView;

  if (passwordNeedsSync || accountNeedsSync) {
    const passwordHash = passwordNeedsSync ? await bcrypt.hash(adminPassword, 12) : existing.passwordHash;
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        isActive: true,
        hasGlobalAccess: true,
        allowGlobalSalesView: true,
        ...(passwordNeedsSync ? { sessionVersion: { increment: 1 } } : {}),
      },
    });
    console.info(
      JSON.stringify({
        event: "bootstrap.admin.synced",
        id: existing.id,
        email: adminEmail,
        passwordChanged: passwordNeedsSync,
      }),
    );
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
