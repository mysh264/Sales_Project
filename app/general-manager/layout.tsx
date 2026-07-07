import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AdminConsoleLink } from "@/components/AdminConsoleLink";

export default function GeneralManagerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:px-8">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link href="/general-manager" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
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
