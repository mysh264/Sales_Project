import { TopNav } from "@/components/ui/TopNav";
import { AdminConsoleLink } from "@/components/AdminConsoleLink";

export default async function SalesmanLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const adminLink = await AdminConsoleLink({ className: "ui-nav-link bg-purple-600 text-white hover:bg-purple-700" });
  return (
    <>
      <TopNav
        brand="Sales"
        homeHref="/salesman"
        items={[{ href: "/profile/security", label: "Security" }]}
        extra={adminLink ?? undefined}
      />
      {children}
    </>
  );
}
