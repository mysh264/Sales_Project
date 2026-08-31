// Audit log of impersonation events for the currently signed-in master tester.
// Read-only. Every IMPERSONATE_START / IMPERSONATE_STOP the tester has done
// (across all sessions) is listed newest-first. Useful for the IT team to
// confirm who did what and when.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { hasPermission, Permissions } from "@/lib/permissions";
import { isMasterTesterEnabled, listMyImpersonationEvents } from "@/app/actions/impersonate";

export const dynamic = "force-dynamic";

function describeValue(action: string, raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const v = raw as Record<string, unknown>;
  if (action === "IMPERSONATE_START") {
    const email = v.targetEmail ?? v.targetUserId;
    const role = v.targetRole;
    return `${role ?? "?"} — ${email ?? "?"}`;
  }
  if (action === "IMPERSONATE_STOP") {
    return `stopped impersonating ${v.stoppedImpersonatingUserId ?? "?"}`;
  }
  return JSON.stringify(v);
}

export default async function TesterAuditPage() {
  const enabled = await isMasterTesterEnabled();
  if (!enabled) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, Permissions.Testers_Impersonate)) {
    redirect("/login");
  }

  const events = await listMyImpersonationEvents(100);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-lg bg-slate-950 p-6 text-white shadow">
          <h1 className="text-2xl font-black">Impersonation audit log</h1>
          <p className="mt-1 text-xs text-slate-400">
            Tester: <code className="rounded bg-slate-800 px-1">{user.email}</code> · last 100 events
          </p>
        </header>

        {events.length === 0 ? (
          <div className="rounded-lg bg-white p-6 text-slate-700 shadow">
            No impersonation events recorded yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg bg-white shadow">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900">
                    {e.action === "IMPERSONATE_START" ? "🟡 Started" : "⚪ Stopped"}
                    <span className="ml-2 font-normal text-slate-700">
                      {describeValue(e.action, e.newValue)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(e.timestamp).toISOString()} · ip {e.ipAddress || "—"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <footer className="text-center text-xs">
          <a href="/tester" className="underline text-slate-500">← back to launchpad</a>
        </footer>
      </div>
    </main>
  );
}
