import { TopNav } from "@/components/ui/TopNav";

export default function ManagerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <TopNav
        brand="Manager"
        homeHref="/manager"
        items={[
          { href: "/manager/dashboard", label: "Finance & Debts" },
          { href: "/manager/all-sales", label: "Sales" },
          { href: "/manager/reconciliation", label: "Reconciliation" },
          { href: "/manager/inventory", label: "Inventory" },
          { href: "/manager/settings", label: "Pricing" },
          { href: "/manager/users", label: "Team" },
          { href: "/profile/security", label: "Security" },
        ]}
      />
      {children}
    </>
  );
}
