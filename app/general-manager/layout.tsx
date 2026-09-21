import { TopNav } from "@/components/ui/TopNav";
import { LocaleToggle, readLocale, t } from "@/components/LocaleToggle";

export default async function GeneralManagerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await readLocale();
  return (
    <>
      <TopNav
        brand={t(locale, "brandGm")}
        homeHref="/general-manager"
        menuLabel={t(locale, "menu")}
        closeLabel={t(locale, "close")}
        logoutLabel={t(locale, "logout")}
        items={[
          { href: "/general-manager/finance", label: t(locale, "brandFinance") },
          { href: "/general-manager/reconciliation", label: t(locale, "reconciliation") },
          { href: "/general-manager/users", label: t(locale, "users") },
          { href: "/general-manager/branches", label: t(locale, "branches") },
          { href: "/general-manager/products", label: t(locale, "products") },
          { href: "/general-manager/inventory", label: t(locale, "inventory") },
          { href: "/general-manager/roles", label: t(locale, "roles") },
          { href: "/general-manager/audit-logs", label: t(locale, "auditLogs") },
          { href: "/profile/security", label: t(locale, "security") },
        ]}
        extra={<LocaleToggle nextPath="/general-manager" />}
      />
      {children}
    </>
  );
}
