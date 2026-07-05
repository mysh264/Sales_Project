import type { UserRole } from "@prisma/client";
import { jwtVerify } from "jose/jwt/verify";
import { NextRequest, NextResponse } from "next/server";
import { allowedForPath, getJwtSecret, roleHome, sessionCookieName, type SessionPayload } from "@/lib/auth";

function loginRedirect(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url));
}

function homeForRole(role: UserRole, request: NextRequest) {
  return NextResponse.redirect(new URL(roleHome[role], request.url));
}

async function readSession(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, getJwtSecret());
    const payload = verified.payload as Partial<SessionPayload>;

    if (!payload.userId || !payload.role || !(payload.role in roleHome)) {
      return null;
    }

    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSession(request);

  if (!session) {
    return loginRedirect(request);
  }

  if (pathname === "/") {
    return homeForRole(session.role, request);
  }

  if (!allowedForPath(session.role, pathname)) {
    return homeForRole(session.role, request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/admin-console/:path*",
    "/salesman/:path*",
    "/loader/:path*",
    "/manager/:path*",
    "/general-manager/:path*",
    "/print/:path*",
  ],
};
