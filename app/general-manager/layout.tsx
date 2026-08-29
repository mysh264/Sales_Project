import { TopNav } from "@/components/ui/TopNav";

export default function GeneralManagerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <TopNav
        brand="GM"
        homeHref="/general-manager"
        items={[
          { href: "/general-manager/finance", label: "Finance" },
          { href: "/general-manager/reconciliation", label: "Reconciliation" },
          { href: "/general-manager/users", label: "Users" },
          { href: "/general-manager/branches", label: "Branches" },
          { href: "/general-manager/products", label: "Products" },
          { href: "/general-manager/inventory", label: "Inventory" },
          { href: "/general-manager/roles", label: "Roles" },
          { href: "/admin/audit-logs", label: "Audit Logs" },
          { href: "/profile/security", label: "Security" },
        ]}
      />
      {children}
    </>
  );
}
