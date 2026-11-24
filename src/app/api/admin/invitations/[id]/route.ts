import { createHash, randomBytes } from "node:crypto";
import { AccountState, AccountType, InvitationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { queueEmail } from "@/lib/email";
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
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60_000);
  const delivery = await prisma.$transaction(async tx => {
    await tx.account.update({ where: { id: invite.accountId }, data: { state: AccountState.INVITED, passwordHash: null } });
    await tx.accountInvite.update({ where: { id }, data: { tokenHash, status: InvitationStatus.PENDING, expiresAt, usedAt: null, revokedAt: null, lastSentAt: new Date() } });
    await tx.auditLog.create({ data: { adminId: session.accountId, action: "ADMIN_INVITATION_RESENT", targetType: "AccountInvite", targetId: id, reason: invite.reason, metadata: { email: invite.account.email } } });
    return queueEmail(tx, { eventKey: `admin-invitation:${id}:${tokenHash}`, to: invite.account.email, recipientAccountId: invite.accountId, subject: "Your NOVA administrator invitation", title: "Your NOVA administrator invitation was renewed", greeting: invite.account.email, message: `${session.account.displayName || session.account.email} renewed your NOVA administrator invitation. Set your password using the secure invitation link before it expires.`, details: [`Reason: ${invite.reason}`, `Expires: ${expiresAt.toLocaleString("en-GB", { timeZone: "Europe/Berlin" })}`], action: { label: "Activate administrator account", url: adminActivationUrl(request.nextUrl.origin, token) } });
  });
  return NextResponse.json({ ok: true, status: InvitationStatus.PENDING, delivery });
}
