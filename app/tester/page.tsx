// Master Tester launchpad.
// Reachable only when:
//   1. MASTERTESTER_ENABLED=true in the deployment .env
//   2. The current session holds the Testers_Impersonate permission
//      (enforced by the routePermissionMap entry in lib/auth.ts).
// Lists every canonical test user (isTestUser=true, role !== TESTER) so the
// tester can switch into one in a single click. The actual switch is
// performed by the startImpersonation server action in
// app/actions/impersonate.ts.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { hasPermission, Permissions } from "@/lib/permissions";
import { isMasterTesterEnabled, listImpersonationTargets, startImpersonation } from "@/app/actions/impersonate";

export const dynamic = "force-dynamic";

export default async function TesterPage() {
  const enabled = await isMasterTesterEnabled();
  if (!enabled) {
    redirect("/login");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!hasPermission(user, Permissions.Testers_Impersonate)) {
    // Not the master tester. Hard deny.
    redirect("/login");
  }

  const targets = await listImpersonationTargets();
  const byRole = new Map<string, typeof targets>();
  for (const t of targets) {
    if (!byRole.has(t.role)) byRole.set(t.role, []);
    byRole.get(t.role)!.push(t);
  }
  const roleOrder = ["ADMIN", "GENERAL_MANAGER", "MANAGER", "LOADER", "SALESMAN"];

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-lg bg-slate-950 p-6 text-white shadow">
          <h1 className="text-3xl font-black">Master Tester</h1>
          <p className="mt-2 text-sm text-slate-300">
            Signed in as <code className="rounded bg-slate-800 px-1">{user.email}</code> · {user.fullName} · {user.role}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Click any user below to become them. Every switch is written to the audit log
            with your id, the target&apos;s id, the IP, and the user agent.
          </p>
        </header>

        {targets.length === 0 ? (
          <div className="rounded-lg bg-white p-6 text-slate-700 shadow">
            <p className="font-bold">No test users seeded yet.</p>
            <p className="mt-2 text-sm">
              Run the database seed (which creates the 11 canonical test users when
              <code className="mx-1 rounded bg-slate-100 px-1">MASTERTESTER_ENABLED=true</code>)
              and reload this page.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {roleOrder
              .filter((r) => byRole.has(r))
              .map((role) => {
                const group = byRole.get(role)!;
                return (
                  <section key={role} className="rounded-lg bg-white p-5 shadow">
                    <h2 className="text-xl font-black text-slate-900">{role.replace(/_/g, " ")}</h2>
                    <p className="mb-3 text-xs text-slate-500">
                      {group.length} test user{group.length === 1 ? "" : "s"}
                    </p>
                    <ul className="divide-y divide-slate-200">
                      {group.map((t) => (
                        <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900">{t.fullName}</div>
                            <div className="text-xs text-slate-500">
                              <code className="rounded bg-slate-100 px-1">{t.email}</code>
                              {t.branchCode && <span className="ml-2">branch: {t.branchName} ({t.branchCode})</span>}
                            </div>
                          </div>
                          <form action={startImpersonation}>
                            <input type="hidden" name="targetUserId" value={t.id} />
                            <button
                              type="submit"
                              className="rounded bg-amber-500 px-4 py-2 font-black text-slate-950 hover:bg-amber-400"
                            >
                              Impersonate
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
          </div>
        )}

        <footer className="text-center text-xs text-slate-500">
          <a href="/tester/audit" className="underline">View my impersonation audit log →</a>
        </footer>
      </div>
    </main>
  );
}
