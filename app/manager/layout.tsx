import { TopNav } from "@/components/ui/TopNav";
import { LocaleToggle, readLocale, t } from "@/components/LocaleToggle";

export default async function ManagerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await readLocale();
  return (
    <>
      <TopNav
        brand={t(locale, "brandManager")}
        homeHref="/manager"
        menuLabel={t(locale, "menu")}
        closeLabel={t(locale, "close")}
        logoutLabel={t(locale, "logout")}
        items={[
          { href: "/manager/dashboard", label: t(locale, "financeDebts") },
          { href: "/manager/all-sales", label: t(locale, "sales") },
          { href: "/manager/reconciliation", label: t(locale, "reconciliation") },
          { href: "/manager/inventory", label: t(locale, "inventory") },
          { href: "/manager/settings", label: t(locale, "pricing") },
          { href: "/manager/users", label: t(locale, "team") },
          { href: "/profile/security", label: t(locale, "security") },
        ]}
        extra={<LocaleToggle nextPath="/manager" />}
      />
      {children}
    </>
  );
}
