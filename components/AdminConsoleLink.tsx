import { jwtVerify } from "jose/jwt/verify";
import Link from "next/link";
import { cookies } from "next/headers";
import { getJwtSecret, sessionCookieName } from "@/lib/auth";

export async function AdminConsoleLink({ className }: { className: string }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, getJwtSecret());

    if (verified.payload.role !== "ADMIN") {
      return null;
    }
  } catch {
    return null;
  }

  return (
    <Link href="/admin" className={className}>
      Admin Console
    </Link>
  );
}

