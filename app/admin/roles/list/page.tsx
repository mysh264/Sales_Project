import { redirect } from "next/navigation";

export default function RoleListRedirectPage() {
  redirect("/admin/roles");
}

