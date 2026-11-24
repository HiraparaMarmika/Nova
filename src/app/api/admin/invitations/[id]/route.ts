import { createHash, randomBytes } from "node:crypto";
import { AccountState, AccountType, InvitationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { sendAdminInvitationEmail } from "@/lib/email";
import { adminActivationUrl } from "@/lib/admin-invitations";

const schema = z.object({ action: z.enum(["resend", "revoke"]) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(AccountType.ADMIN);
  if (!session) return NextResponse.json({ error: "admin_session_required" }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const id = (await params).id;
  const invite = await prisma.accountInvite.findUnique({ where: { id }, include: { account: true } });
  if (!invite) return NextResponse.json({ error: "invitation_not_found" }, { status: 404 });

  if (input.data.action === "revoke") {
    if (invite.status === InvitationStatus.ACCEPTED) return NextResponse.json({ error: "accepted_invitation" }, { status: 409 });
    await prisma.$transaction([prisma.accountInvite.update({ where: { id }, data: { status: InvitationStatus.REVOKED, revokedAt: new Date() } }), prisma.account.update({ where: { id: invite.accountId }, data: { state: AccountState.SUSPENDED } }), prisma.auditLog.create({ data: { adminId: session.accountId, action: "ADMIN_INVITATION_REVOKED", targetType: "AccountInvite", targetId: id, reason: "Invitation revoked", metadata: { email: invite.account.email } } })]);
    return NextResponse.json({ ok: true, status: InvitationStatus.REVOKED });
  }

  if (invite.status === InvitationStatus.ACCEPTED || invite.status === InvitationStatus.REVOKED) return NextResponse.json({ error: "invitation_not_resendable" }, { status: 409 });
  const token = randomBytes(32).toString("base64url"); const expiresAt = new Date(Date.now() + 48 * 60 * 60_000);
  await prisma.$transaction([prisma.account.update({ where: { id: invite.accountId }, data: { state: AccountState.INVITED, passwordHash: null } }), prisma.accountInvite.update({ where: { id }, data: { tokenHash: createHash("sha256").update(token).digest("hex"), status: InvitationStatus.PENDING, expiresAt, usedAt: null, revokedAt: null, lastSentAt: new Date() } }), prisma.auditLog.create({ data: { adminId: session.accountId, action: "ADMIN_INVITATION_RESENT", targetType: "AccountInvite", targetId: id, reason: invite.reason, metadata: { email: invite.account.email } } })]);
  try {
    const delivery = await sendAdminInvitationEmail({ to: invite.account.email, inviter: session.account.displayName || session.account.email, reason: invite.reason, activationUrl: adminActivationUrl(request.nextUrl.origin, token), expiresAt });
    return NextResponse.json({ ok: true, status: InvitationStatus.PENDING, delivery });
  } catch { return NextResponse.json({ error: "invitation_delivery_failed" }, { status: 503 }); }
}
