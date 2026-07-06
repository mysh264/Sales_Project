import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import { logAction } from "@/lib/audit";
import { formatDateDMY } from "@/lib/date-format";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AuditLogTable } from "./AuditLogTable";

export const dynamic = "force-dynamic";

type AuditLogsPageProps = {
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    startDate?: string;
    endDate?: string;
    userId?: string;
    actionGroup?: string;
    targetId?: string;
  }>;
};

const ACTION_GROUPS: Record<string, { label: string; actions: string[] }> = {
  all: { label: "All Actions", actions: [] },
  invoice_changes: { label: "Invoice Changes", actions: ["CREATE_INVOICE", "UPDATE_INVOICE"] },
  invoice_deletions: { label: "Invoice Deletions", actions: ["DELETE_INVOICE"] },
  inventory_changes: {
    label: "Inventory Changes",
    actions: ["UPDATE_INVENTORY", "PROCESS_MORNING_LOAD", "PROCESS_EVENING_RETURN"],
  },
  user_changes: { label: "User / Permission Changes", actions: ["CREATE_USER", "UPDATE_PERMISSION"] },
  role_changes: { label: "Role Changes", actions: ["CREATE_ROLE", "UPDATE_ROLE", "DELETE_ROLE"] },
  debt_collection: { label: "Debt Collection", actions: ["COLLECT_DEBT"] },
  pricing: { label: "Price Management", actions: ["UPDATE_PRICE_RULE"] },
  security_breaches: { label: "Security Breaches", actions: ["SECURITY_BREACH"] },
};

function parsePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "50", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 10), 500) : 50;
}

function startOfDay(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function endOfDay(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.role !== "ADMIN") {
    await logAction(
      currentUser.id,
      "SECURITY_BREACH",
      "AuditLog",
      "admin/audit-logs",
      null,
      {
        requiredPermission: "ADMIN_ACCESS",
        role: currentUser.role,
        reason: "Audit logs are admin-only.",
      },
    );
    forbidden();
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const page = parsePage(resolvedSearchParams.page);
  const pageSize = parsePageSize(resolvedSearchParams.pageSize);
  const startDate = startOfDay(resolvedSearchParams.startDate);
  const endDate = endOfDay(resolvedSearchParams.endDate);
  const userId = resolvedSearchParams.userId?.trim() === "all" ? undefined : resolvedSearchParams.userId?.trim() || undefined;
  const actionGroup = resolvedSearchParams.actionGroup?.trim() || "all";
  const targetId = resolvedSearchParams.targetId?.trim() || undefined;

  const selectedGroup = ACTION_GROUPS[actionGroup] ?? ACTION_GROUPS.all;
  const where = {
    ...(userId ? { userId } : {}),
    ...(selectedGroup.actions.length > 0 ? { action: { in: selectedGroup.actions } } : {}),
    ...(targetId ? { targetId: { contains: targetId, mode: "insensitive" as const } } : {}),
    ...(startDate || endDate
      ? {
          timestamp: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {}),
  };

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      include: { branch: true },
      orderBy: [{ fullName: "asc" }],
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: true,
    },
    orderBy: [{ timestamp: "desc" }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  });
  const pageStart = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min((safePage - 1) * pageSize + logs.length, totalCount);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">Security / Audit</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Audit Log Inspection</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold text-slate-600">
                Global access for the admin role. Logs are read-only and include transaction snapshots for review.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/admin" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
                Back to Admin
              </Link>
              <Link href="/admin-console" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">
                Console
              </Link>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6">
            <h2 className="text-lg font-black text-slate-950">Filters</h2>
            <form method="get" className="mt-4 space-y-4">
              <input type="hidden" name="page" value="1" />
              <div className="grid grid-cols-1 gap-3">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Date From</span>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={resolvedSearchParams.startDate ?? ""}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Date To</span>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={resolvedSearchParams.endDate ?? ""}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">User</span>
                  <select
                    name="userId"
                    defaultValue={userId ?? ""}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
                  >
                    <option value="">All Users</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName} · {user.role.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Action Type</span>
                  <select
                    name="actionGroup"
                    defaultValue={actionGroup}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
                  >
                    {Object.entries(ACTION_GROUPS).map(([key, option]) => (
                      <option key={key} value={key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Target ID</span>
                  <input
                    type="text"
                    name="targetId"
                    defaultValue={targetId ?? ""}
                    placeholder="Search by target ID"
                    className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Page Size</span>
                  <select
                    name="pageSize"
                    defaultValue={String(pageSize)}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
                  >
                    {[25, 50, 100, 250, 500].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 rounded bg-slate-950 px-4 py-3 text-sm font-black text-white">
                  Apply
                </button>
                <Link href="/admin/audit-logs" className="rounded border border-slate-300 px-4 py-3 text-sm font-black text-slate-900">
                  Reset
                </Link>
              </div>
            </form>

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Scope</p>
              <p className="mt-2 text-sm font-bold text-slate-700">Admin-only visibility. No branch scoping is applied here.</p>
            </div>
          </aside>

          <section className="flex flex-col gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Results</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    Showing {pageStart}-{pageEnd} of {totalCount}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm font-black">
                  <span className="rounded bg-slate-100 px-3 py-2 text-slate-700">
                    Page {safePage} of {totalPages}
                  </span>
                  <Link
                    href={`/admin/audit-logs${buildQueryString({
                      page: Math.max(safePage - 1, 1),
                      pageSize,
                      startDate: resolvedSearchParams.startDate,
                      endDate: resolvedSearchParams.endDate,
                      userId,
                      actionGroup,
                      targetId,
                    })}`}
                    className={`rounded px-3 py-2 ${safePage > 1 ? "bg-slate-950 text-white" : "pointer-events-none bg-slate-200 text-slate-500"}`}
                  >
                    Prev
                  </Link>
                  <Link
                    href={`/admin/audit-logs${buildQueryString({
                      page: Math.min(safePage + 1, totalPages),
                      pageSize,
                      startDate: resolvedSearchParams.startDate,
                      endDate: resolvedSearchParams.endDate,
                      userId,
                      actionGroup,
                      targetId,
                    })}`}
                    className={`rounded px-3 py-2 ${safePage < totalPages ? "bg-slate-950 text-white" : "pointer-events-none bg-slate-200 text-slate-500"}`}
                  >
                    Next
                  </Link>
                </div>
              </div>
            </div>

            <AuditLogTable
              logs={logs.map((log) => ({
                id: log.id,
                timestamp: formatDateDMY(log.timestamp),
                action: log.action,
                targetModel: log.targetModel,
                targetId: log.targetId,
                oldValue: log.oldValue,
                newValue: log.newValue,
                user: {
                  fullName: log.user.fullName,
                  role: log.user.role,
                },
              }))}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
