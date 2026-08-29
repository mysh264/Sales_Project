import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildCsv, csvResponse } from "@/lib/csv";
import { businessDayRange } from "@/lib/business-date";

export const dynamic = "force-dynamic";

function startOfDay(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : businessDayRange(date).start;
}
function endOfDay(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : new Date(businessDayRange(date).end.getTime() - 1);
}

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return new Response("Unauthorized", { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const userId = sp.get("userId")?.trim() === "all" ? undefined : sp.get("userId")?.trim() || undefined;
  const action = sp.get("action")?.trim() || undefined;
  const targetId = sp.get("targetId")?.trim() || undefined;
  const startDate = startOfDay(sp.get("startDate") || undefined);
  const endDate = endOfDay(sp.get("endDate") || undefined);

  const where = {
    ...(userId ? { userId } : {}),
    ...(action ? { action } : {}),
    ...(targetId ? { targetId: { contains: targetId, mode: "insensitive" as const } } : {}),
    ...(startDate || endDate
      ? { timestamp: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
      : {}),
  };

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: true },
    orderBy: { timestamp: "desc" },
    take: 5000,
  });

  const rows = logs.map((log) => [
    log.timestamp.toISOString(),
    log.user.fullName,
    log.user.role,
    log.action,
    log.targetModel,
    log.targetId,
    JSON.stringify(log.oldValue ?? null),
    JSON.stringify(log.newValue ?? null),
    log.ipAddress,
    log.userAgent,
  ]);

  const csv = buildCsv(
    ["timestamp", "user", "role", "action", "targetModel", "targetId", "oldValue", "newValue", "ipAddress", "userAgent"],
    rows,
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`audit-log-${stamp}.csv`, csv);
}
