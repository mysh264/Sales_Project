import { TopNav } from "@/components/ui/TopNav";
import { LocaleToggle, readLocale, t } from "@/components/LocaleToggle";

export default async function FinanceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await readLocale();
  return (
    <>
      <TopNav
        brand={t(locale, "brandFinance")}
        homeHref="/finance/reconciliation-overview"
        menuLabel={t(locale, "menu")}
        closeLabel={t(locale, "close")}
        logoutLabel={t(locale, "logout")}
        items={[
          { href: "/finance/reconciliation-overview", label: t(locale, "reconciliation") },
          { href: "/finance/statements", label: t(locale, "statements") },
        ]}
        extra={<LocaleToggle nextPath="/finance/reconciliation-overview" />}
      />
      {children}
    </>
  );
}
