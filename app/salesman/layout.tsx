import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AdminConsoleLink } from "@/components/AdminConsoleLink";

export default function SalesmanLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="bg-white px-3 py-3 shadow-sm print:hidden md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/salesman"
              className="flex min-h-14 items-center justify-center rounded-lg bg-slate-950 px-4 text-lg font-black text-white"
            >
              Home
            </Link>
            <AdminConsoleLink className="hidden min-h-14 items-center justify-center rounded-lg bg-purple-700 px-4 text-lg font-black text-white md:flex" />
          </div>
          <form action={logout} className="ml-auto">
            <button type="submit" className="min-h-14 rounded-lg bg-red-700 px-4 text-lg font-black text-white">
              Logout
            </button>
          </form>
        </div>
      </nav>
      {children}
    </>
  );
}
