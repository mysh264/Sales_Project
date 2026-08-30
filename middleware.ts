import type { UserRole } from "@/generated/prisma/client";
import { jwtVerify } from "jose/jwt/verify";
import { NextRequest, NextResponse } from "next/server";
import { allowedForPath, getJwtSecret, roleHome, sessionCookieName, type SessionPayload } from "@/lib/auth";

function redirectPath(request: NextRequest, pathname: string) {
  const configuredOrigin = process.env.APP_ORIGIN;
  const headerHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const safeHeaderHost = headerHost && /^[a-zA-Z0-9.:[\]-]+$/.test(headerHost) ? headerHost : null;
  const origin = configuredOrigin || `${request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "")}://${safeHeaderHost || request.nextUrl.host}`;
  return NextResponse.redirect(new URL(pathname, origin));
}

function loginRedirect(request: NextRequest) {
  return redirectPath(request, "/login");
}

function unauthorizedResponse() {
  return new NextResponse("Unauthorized", { status: 403 });
}

function homeForRole(role: UserRole, request: NextRequest) {
  return redirectPath(request, roleHome[role]);
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

  if (!allowedForPath(session.role, pathname, session.permissions ?? [])) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/api/:path*",
    "/admin/:path*",
    "/admin-console",
    "/admin-console/:path*",
    "/salesman/:path*",
    "/loader/:path*",
    "/logistics/:path*",
    "/manager/:path*",
    "/finance/:path*",
    "/general-manager/:path*",
    "/print/:path*",
    "/profile/:path*",
  ],
};
