import { redirect } from "next/navigation";

export default function CreateRoleRedirectPage() {
  redirect("/admin/roles");
}

