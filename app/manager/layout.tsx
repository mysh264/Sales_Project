import Link from "next/link";
import { logout } from "@/app/actions/auth";

export default function ManagerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/manager" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
              Home
            </Link>
            <Link href="/manager/dashboard" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
              Finance & Debts
            </Link>
            <Link href="/manager/all-sales" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
              Sales
            </Link>
            <Link href="/manager/reconciliation" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
              Reconciliation
            </Link>
            <Link href="/manager/inventory" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
              Inventory
            </Link>
            <Link href="/manager/settings" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
              Pricing
            </Link>
            <Link href="/manager/users" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
              Team
            </Link>
            <Link href="/profile/security" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
              Security
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
