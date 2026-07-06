"use server";

import bcrypt from "bcryptjs";
import { SignJWT } from "jose/jwt/sign";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getJwtSecret, sessionCookieName, type SessionPayload } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function login(formData: FormData) {
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { roleProfile: true },
  });

  if (!user || !user.isActive || !user.passwordHash) {
    throw new Error("Invalid login.");
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);

  if (!passwordOk) {
    throw new Error("Invalid login.");
  }

  const payload: SessionPayload = {
    userId: user.id,
    role: user.role,
    permissions: getEffectivePermissions(user),
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getJwtSecret());

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return user.role;
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
  redirect("/login");
}
