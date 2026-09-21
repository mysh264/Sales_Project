import { redirect } from "next/navigation";

// The Admin home is consolidated into the Admin Console to avoid a duplicate
// dashboard. All admin links should target /admin-console.
export default function AdminHomePage() {
  redirect("/admin-console");
}
