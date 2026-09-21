import { TopNav } from "@/components/ui/TopNav";
import { AdminConsoleLink } from "@/components/AdminConsoleLink";
import { LocaleToggle, readLocale, t } from "@/components/LocaleToggle";

export default async function SalesmanLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await readLocale();
  const adminLink = await AdminConsoleLink({ className: "ui-nav-link" });
  return (
    <>
      <TopNav
        brand={t(locale, "brandSales")}
        homeHref="/salesman"
        menuLabel={t(locale, "menu")}
        closeLabel={t(locale, "close")}
        logoutLabel={t(locale, "logout")}
        items={[
          { href: "/salesman/new-order", label: t(locale, "newOrder") },
          { href: "/salesman/history", label: t(locale, "history") },
          { href: "/profile/security", label: t(locale, "security") },
        ]}
        extra={
          <>
            <LocaleToggle nextPath="/salesman" />
            {adminLink ?? null}
          </>
        }
      />
      {children}
    </>
  );
}
