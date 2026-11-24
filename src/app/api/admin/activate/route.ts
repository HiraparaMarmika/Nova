import { createHash } from "node:crypto";
import { AccountState, InvitationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const schema = z.object({ token: z.string().min(40).max(200), password: z.string().min(12).max(256) });
export async function POST(request: NextRequest) {
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_activation" }, { status: 400 });
  const tokenHash = createHash("sha256").update(input.data.token).digest("hex");
  const passwordHash = await hashPassword(input.data.password); const now = new Date();
  const activated = await prisma.$transaction(async tx => {
    const invite = await tx.accountInvite.findUnique({ where: { tokenHash } });
    if (!invite || invite.status !== InvitationStatus.PENDING || invite.usedAt || invite.expiresAt <= now) {
      if (invite?.status === InvitationStatus.PENDING && invite.expiresAt <= now) await tx.accountInvite.update({ where: { id: invite.id }, data: { status: InvitationStatus.EXPIRED } });
      return false;
    }
    const claimed = await tx.accountInvite.updateMany({ where: { id: invite.id, status: InvitationStatus.PENDING, usedAt: null }, data: { status: InvitationStatus.ACCEPTED, usedAt: now } });
    if (claimed.count !== 1) return false;
    await tx.account.update({ where: { id: invite.accountId }, data: { state: AccountState.ACTIVE, passwordHash } });
    return true;
  });
  if (!activated) return NextResponse.json({ error: "invitation_unavailable" }, { status: 410 });
  return NextResponse.json({ ok: true });
}
