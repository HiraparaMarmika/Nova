import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

const schema = z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(12).max(256) });
export async function PATCH(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success || !await verifyPassword(input.data.currentPassword, session.account.passwordHash)) return NextResponse.json({ error: "current_password_incorrect" }, { status: 400 });
  await prisma.$transaction([prisma.account.update({ where: { id: session.accountId }, data: { passwordHash: await hashPassword(input.data.newPassword) } }), prisma.session.deleteMany({ where: { accountId: session.accountId, id: { not: session.id } } })]);
  return NextResponse.json({ ok: true });
}
