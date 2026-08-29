import { TopNav } from "@/components/ui/TopNav";
import { AdminConsoleLink } from "@/components/AdminConsoleLink";

export default async function LoaderLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const adminLink = await AdminConsoleLink({ className: "ui-nav-link bg-purple-600 text-white hover:bg-purple-700" });
  return (
    <>
      <TopNav
        brand="Loader"
        homeHref="/loader"
        showHome
        items={[
          { href: "/logistics/reconciliation", label: "Daily Reconciliation" },
          { href: "/profile/security", label: "Security" },
        ]}
        extra={adminLink ?? undefined}
      />
      {children}
    </>
  );
}
