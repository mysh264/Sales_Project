import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AdminConsoleLink } from "@/components/AdminConsoleLink";

export default function LoaderLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="border-b border-slate-200 bg-white p-3 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-3">
          <Link
            href="/loader"
            className="flex min-h-12 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white"
          >
            Home
          </Link>
          <Link
            href="/logistics/reconciliation"
            className="flex min-h-12 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-black text-white"
          >
            Daily Reconciliation
          </Link>
          <AdminConsoleLink className="flex min-h-12 items-center justify-center rounded-lg bg-purple-700 px-4 text-sm font-black text-white" />
          <form action={logout}>
            <button
              type="submit"
              className="min-h-12 rounded-lg bg-red-700 px-4 text-sm font-black text-white"
            >
              Logout
            </button>
          </form>
        </div>
      </nav>
      {children}
    </>
  );
}
