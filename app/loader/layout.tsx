import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AdminConsoleLink } from "@/components/AdminConsoleLink";

export default function LoaderLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="bg-white p-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl gap-3">
          <Link
            href="/loader"
            className="flex min-h-14 flex-1 items-center justify-center rounded-lg bg-slate-950 px-4 text-lg font-black text-white"
          >
            Home
          </Link>
          <AdminConsoleLink className="flex min-h-14 flex-1 items-center justify-center rounded-lg bg-purple-700 px-4 text-lg font-black text-white" />
          <form action={logout} className="flex-1">
            <button
              type="submit"
              className="min-h-14 w-full rounded-lg bg-red-700 px-4 text-lg font-black text-white"
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
