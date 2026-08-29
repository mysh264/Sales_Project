import { TopNav } from "@/components/ui/TopNav";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <TopNav
        brand="Admin"
        homeHref="/admin"
        items={[
          { href: "/admin/users", label: "Users" },
          { href: "/admin/finance", label: "Finance" },
          { href: "/admin/sales", label: "Sales" },
          { href: "/admin/reconciliation", label: "Reconciliation" },
          { href: "/admin/audit-logs", label: "Audit Logs" },
          { href: "/admin/products", label: "Products" },
          { href: "/admin/inventory", label: "Inventory" },
          { href: "/admin/roles", label: "Roles" },
          { href: "/admin/branches", label: "Branches" },
          { href: "/profile/security", label: "Security" },
        ]}
      />
      {children}
    </>
  );
}
