import Link from "next/link";
import { logout } from "@/app/actions/auth";

export default function GeneralManagerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:px-8">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-3">
            <Link href="/general-manager" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">Home</Link>
            <Link href="/general-manager/finance" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">Finance</Link>
            <Link href="/general-manager/reconciliation" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">Reconciliation</Link>
            <Link href="/general-manager/users" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">Users</Link>
            <Link href="/general-manager/branches" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">Branches</Link>
            <Link href="/general-manager/products" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">Products</Link>
            <Link href="/general-manager/inventory" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">Inventory</Link>
            <Link href="/general-manager/roles" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">Roles</Link>
            <Link href="/profile/security" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-900">Security</Link>
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
