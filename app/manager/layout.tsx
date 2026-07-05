import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AdminConsoleLink } from "@/components/AdminConsoleLink";

export default function ManagerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="border-b border-slate-200 bg-white px-8 py-3 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/manager" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
            Home
          </Link>
          <AdminConsoleLink className="rounded bg-purple-700 px-4 py-2 text-sm font-black text-white" />
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
