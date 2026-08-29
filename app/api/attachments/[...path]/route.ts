import { NextResponse } from "next/server";
import { invoiceAccessWhere } from "@/lib/invoice-access";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { readPrivateUpload } from "@/lib/uploads";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { path } = await params;
  const attachmentUrl = `/api/attachments/${path.map(encodeURIComponent).join("/")}`;
  const payment = await prisma.payment.findFirst({
    where: {
      attachmentUrl,
      invoice: invoiceAccessWhere(currentUser),
    },
    select: { id: true },
  });

  if (!payment) {
    return new NextResponse("Not found", { status: 404 });
  }

  const contents = await readPrivateUpload(path);
  if (!contents) {
    return new NextResponse("Not found", { status: 404 });
  }

  const extension = path[1]?.split(".").pop()?.toLowerCase();
  const contentType = extension === "pdf" ? "application/pdf" : extension === "png" ? "image/png" : "image/jpeg";
  return new NextResponse(contents, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
