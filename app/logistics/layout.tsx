import { TopNav } from "@/components/ui/TopNav";
import { AdminConsoleLink } from "@/components/AdminConsoleLink";
import { LocaleToggle, readLocale, t } from "@/components/LocaleToggle";

/** Keep loader chrome when navigating to /logistics/* (shared reconciliation workbench). */
export default async function LogisticsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await readLocale();
  const adminLink = await AdminConsoleLink({ className: "ui-nav-link" });
  return (
    <>
      <TopNav
        brand={t(locale, "brandLoader")}
        homeHref="/loader"
        showHome
        menuLabel={t(locale, "menu")}
        closeLabel={t(locale, "close")}
        logoutLabel={t(locale, "logout")}
        items={[
          { href: "/logistics/reconciliation", label: t(locale, "reconciliation") },
          { href: "/profile/security", label: t(locale, "security") },
        ]}
        extra={
          <>
            <LocaleToggle nextPath="/logistics/reconciliation" />
            {adminLink ?? null}
          </>
        }
      />
      {children}
    </>
  );
}
