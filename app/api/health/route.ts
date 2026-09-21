import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ok", timestamp: new Date().toISOString() });
  } catch (error) {
    logEvent("error", "health.database_unavailable", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      { status: "unhealthy", database: "unavailable", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
