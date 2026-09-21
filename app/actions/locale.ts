"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE, normalizeLocale, type AppLocale } from "@/lib/i18n";

export async function setAppLocale(formData: FormData) {
  const next = normalizeLocale(String(formData.get("locale") ?? "en")) as AppLocale;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, next, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
  const nextPath = String(formData.get("next") ?? "/salesman");
  redirect(nextPath.startsWith("/") ? nextPath : "/salesman");
}
