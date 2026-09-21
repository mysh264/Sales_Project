"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { useEffect, useState, type ReactNode } from "react";

export type NavItem = { href: string; label: string };

export function TopNav({
  brand,
  items,
  showHome = true,
  homeHref,
  extra,
  menuLabel = "Menu",
  closeLabel = "Close",
  logoutLabel = "Logout",
}: {
  brand?: ReactNode;
  items: NavItem[];
  showHome?: boolean;
  homeHref?: string;
  extra?: ReactNode;
  menuLabel?: string;
  closeLabel?: string;
  logoutLabel?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/" || href === homeHref) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const links = (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`ui-nav-link ${isActive(item.href) ? "ui-nav-link-active" : ""}`}
          onClick={() => setOpen(false)}
        >
          {item.label}
        </Link>
      ))}
      {extra}
    </>
  );

  return (
    <nav className="ui-nav">
      <div className="mx-auto flex max-w-screen-xl items-center gap-2 px-3 py-2.5 md:px-6">
        {showHome && homeHref ? (
          <Link href={homeHref} className="ui-brandmark mr-1 shrink-0">
            {brand ?? "Home"}
          </Link>
        ) : null}

        <div className="hidden flex-1 flex-wrap items-center gap-1.5 md:flex">{links}</div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="ui-btn ui-btn-ghost ui-btn-sm md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav-drawer"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? closeLabel : menuLabel}
          </button>
          <form action={logout}>
            <button type="submit" className="ui-btn ui-btn-ghost ui-btn-sm">
              {logoutLabel}
            </button>
          </form>
        </div>
      </div>

      {open ? (
        <div
          id="mobile-nav-drawer"
          className="border-t border-slate-200 bg-white px-3 py-3 md:hidden"
        >
          <div className="flex flex-col gap-1.5">{links}</div>
        </div>
      ) : null}
    </nav>
  );
}
