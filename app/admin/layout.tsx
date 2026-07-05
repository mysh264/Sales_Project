import Link from "next/link";
import { logout } from "@/app/actions/auth";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="border-b border-slate-200 bg-white px-8 py-3 shadow-sm">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-3">
          <Link href="/admin" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
            Home
          </Link>
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

