import { AccountType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";

const schema = z.object({ status: z.enum(["APPROVED", "REJECTED"]), reason: z.string().trim().min(3).max(500) });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(AccountType.ADMIN);
  if (!session) return NextResponse.json({ error: "admin_session_required" }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_review" }, { status: 400 });
  const id = (await params).id;
  await prisma.$transaction([prisma.document.update({ where: { id }, data: { status: input.data.status, approvedAt: input.data.status === "APPROVED" ? new Date() : null } }), prisma.auditLog.create({ data: { adminId: session.accountId, action: `DOCUMENT_${input.data.status}`, targetType: "Document", targetId: id, reason: input.data.reason } })]);
  return NextResponse.json({ ok: true });
}
