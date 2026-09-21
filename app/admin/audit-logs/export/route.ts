import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildCsv, csvResponse } from "@/lib/csv";
import { businessDayRange } from "@/lib/business-date";
import { auditActionsForGroup } from "@/lib/audit-action-groups";

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
  if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "GENERAL_MANAGER")) {
    return new Response("Unauthorized", { status: 403 });
  }
  const isGM = currentUser.role === "GENERAL_MANAGER";

  const sp = request.nextUrl.searchParams;
  const userId = sp.get("userId")?.trim() === "all" ? undefined : sp.get("userId")?.trim() || undefined;
  const actions = auditActionsForGroup(sp.get("actionGroup")?.trim());
  const targetId = sp.get("targetId")?.trim() || undefined;
  const startDate = startOfDay(sp.get("startDate") || undefined);
  const endDate = endOfDay(sp.get("endDate") || undefined);

  const where = {
    ...(isGM && currentUser.branchId ? { user: { branchId: currentUser.branchId } } : {}),
    ...(userId ? { userId } : {}),
    ...(actions.length > 0 ? { action: { in: actions } } : {}),
    ...(targetId ? { targetId: { contains: targetId, mode: "insensitive" as const } } : {}),
    ...(startDate || endDate
      ? { timestamp: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
      : {}),
  };

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: true, effectiveUser: true },
    orderBy: { timestamp: "desc" },
    take: 5000,
  });

  const truncated = logs.length >= 5000;

  const rows = logs.map((log) => [
    log.timestamp.toISOString(),
    log.user.fullName,
    log.user.role,
    log.effectiveUser?.fullName ?? "",
    log.effectiveUser?.role ?? "",
    log.action,
    log.targetModel,
    log.targetId,
    JSON.stringify(log.oldValue ?? null),
    JSON.stringify(log.newValue ?? null),
    log.ipAddress,
    log.userAgent,
  ]);

  const csv = buildCsv(
    [
      "timestamp",
      "user",
      "role",
      "effectiveUser",
      "effectiveUserRole",
      "action",
      "targetModel",
      "targetId",
      "oldValue",
      "newValue",
      "ipAddress",
      "userAgent",
    ],
    rows,
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const response = csvResponse(`audit-log-${stamp}.csv`, csv);
  if (truncated) {
    response.headers.set("X-Export-Truncated", "true");
    response.headers.set(
      "X-Export-Truncation-Note",
      "Export capped at 5000 rows. Narrow filters to retrieve older records.",
    );
  }
  return response;
}
