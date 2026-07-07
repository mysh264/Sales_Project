import Link from "next/link";
import { logout } from "@/app/actions/auth";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:px-8">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
              Home
            </Link>
            <Link href="/admin-console" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">
              Admin Console
            </Link>
            <Link href="/admin/audit-logs" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">
              Audit Logs
            </Link>
            <Link href="/admin/products" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">
              Products
            </Link>
            <Link href="/admin/roles" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">
              Roles
            </Link>
            <Link href="/admin/branches" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">
              Branches
            </Link>
          </div>
          <form action={logout}>
            <button type="submit" className="rounded bg-red-700 px-4 py-2 text-sm font-black text-white">
              Logout
            </button>
          </form>
        </div>
      </nav>
      {children}
    </>
  );
}
