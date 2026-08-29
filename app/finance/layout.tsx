import { TopNav } from "@/components/ui/TopNav";

export default function FinanceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <TopNav
        brand="Finance"
        homeHref="/finance/reconciliation-overview"
        items={[
          { href: "/finance/reconciliation-overview", label: "Reconciliation" },
          { href: "/finance/statements", label: "Statements" },
        ]}
      />
      {children}
    </>
  );
}
