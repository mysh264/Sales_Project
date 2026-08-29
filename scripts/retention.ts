import { PrismaClient } from "@/generated/prisma/client";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { uploadRoot } from "../lib/uploads";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 }) });

async function removeOrphanUploads() {
  const referenced = new Set(
    (await prisma.payment.findMany({ where: { attachmentUrl: { not: null } }, select: { attachmentUrl: true } }))
      .map((row) => row.attachmentUrl)
      .filter((value): value is string => Boolean(value)),
  );
  const root = uploadRoot();
  for (const folder of ["checks", "transfers"]) {
    const directory = path.join(root, folder);
    let names: string[] = [];
    try { names = await readdir(directory); } catch { continue; }
    for (const name of names) {
      const target = path.join(directory, name);
      const info = await stat(target);
      const url = `/api/attachments/${folder}/${name}`;
      if (!referenced.has(url) && Date.now() - info.mtimeMs > 24 * 60 * 60 * 1000) await unlink(target);
    }
  }
}

async function main() {
  const days = Number(process.env.AUDIT_RETENTION_DAYS ?? "365");
  if (!Number.isInteger(days) || days < 30) throw new Error("AUDIT_RETENTION_DAYS must be an integer of at least 30.");
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const deleted = await prisma.auditLog.deleteMany({ where: { timestamp: { lt: cutoff } } });
  await removeOrphanUploads();
  console.info(JSON.stringify({ event: "retention.complete", deletedAuditLogs: deleted.count, cutoff: cutoff.toISOString() }));
}

main().finally(() => prisma.$disconnect());
