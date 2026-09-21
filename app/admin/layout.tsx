import { TopNav } from "@/components/ui/TopNav";
import { LocaleToggle, readLocale, t } from "@/components/LocaleToggle";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await readLocale();
  return (
    <>
      <TopNav
        brand={t(locale, "brandAdmin")}
        homeHref="/admin"
        menuLabel={t(locale, "menu")}
        closeLabel={t(locale, "close")}
        logoutLabel={t(locale, "logout")}
        items={[
          { href: "/admin/users", label: t(locale, "users") },
          { href: "/admin/finance", label: t(locale, "brandFinance") },
          { href: "/admin/sales", label: t(locale, "sales") },
          { href: "/admin/reconciliation", label: t(locale, "reconciliation") },
          { href: "/admin/audit-logs", label: t(locale, "auditLogs") },
          { href: "/admin/products", label: t(locale, "products") },
          { href: "/admin/inventory", label: t(locale, "inventory") },
          { href: "/admin/roles", label: t(locale, "roles") },
          { href: "/admin/branches", label: t(locale, "branches") },
          { href: "/profile/security", label: t(locale, "security") },
        ]}
        extra={<LocaleToggle nextPath="/admin" />}
      />
      {children}
    </>
  );
}
