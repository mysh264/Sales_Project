"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import type { ReactNode } from "react";

export type NavItem = { href: string; label: string };

export function TopNav({
  brand,
  items,
  showHome = true,
  homeHref,
  extra,
}: {
  brand?: ReactNode;
  items: NavItem[];
  showHome?: boolean;
  homeHref?: string;
  extra?: ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/" || href === homeHref) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="ui-nav">
      <div className="mx-auto flex max-w-screen-xl flex-wrap items-center gap-2 px-3 py-2.5 md:px-6">
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {showHome && homeHref ? (
            <Link href={homeHref} className="ui-brandmark mr-1">
              {brand ?? "Home"}
            </Link>
          ) : null}
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`ui-nav-link ${isActive(item.href) ? "ui-nav-link-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
          {extra}
        </div>
        <form action={logout} className="ml-auto">
          <button type="submit" className="ui-btn ui-btn-ghost ui-btn-sm">
            Logout
          </button>
        </form>
      </div>
    </nav>
  );
}
