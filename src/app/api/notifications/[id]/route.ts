import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const result = await prisma.notification.updateMany({ where: { id: (await params).id, accountId: session.accountId }, data: { readAt: new Date() } });
  if (!result.count) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
