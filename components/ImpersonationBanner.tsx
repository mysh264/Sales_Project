// Top-of-page banner shown whenever the current session was issued by the
// master tester via impersonation. Reads the session payload, looks up the
// impersonator's email, and renders a clear "you are X, not yourself"
// indicator with a "Stop impersonating" button that calls the
// stopImpersonation server action.
import { getSessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { stopImpersonation } from "@/app/actions/impersonate";

export const dynamic = "force-dynamic";

export async function ImpersonationBanner() {
  const session = await getSessionPayload();
  if (!session?.impersonatorId) return null;

  // Look up both the impersonator (the tester) and the impersonated user
  // (the target) so the banner can show "as X — original Y".
  const [tester, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.impersonatorId }, select: { email: true, fullName: true } }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { email: true, fullName: true, role: true } }),
  ]);

  return (
    <div
      role="alert"
      className="w-full bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 shadow"
      style={{ position: "sticky", top: 0, zIndex: 60 }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <div>
          ⚠ Impersonating
          {target ? (
            <span className="ml-1">
              <strong>{target.fullName}</strong>
              {target.email && <code className="ml-1 rounded bg-amber-600/30 px-1 text-xs">{target.email}</code>}
              <span className="ml-2 rounded bg-amber-600/40 px-1 text-xs">{target.role}</span>
            </span>
          ) : (
            <span className="ml-1">unknown user (id {session.userId})</span>
          )}
          {tester && (
            <span className="ml-3 text-xs font-normal text-slate-800">
              Original session: <code className="rounded bg-amber-600/30 px-1">{tester.email}</code>
            </span>
          )}
        </div>
        <form action={stopImpersonation}>
          <button
            type="submit"
            className="rounded bg-slate-950 px-3 py-1 text-xs font-black text-white hover:bg-slate-800"
          >
            Stop impersonating
          </button>
        </form>
      </div>
    </div>
  );
}
