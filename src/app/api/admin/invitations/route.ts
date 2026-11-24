import { createHash, randomBytes } from "node:crypto";
import { AccountState, AccountType, InvitationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { queueEmail } from "@/lib/email";
import { adminActivationUrl } from "@/lib/admin-invitations";

const schema = z.object({ email: z.string().email().max(320), reason: z.string().trim().min(3).max(500) });
const INVITATION_HOURS = 48;

export async function POST(request: NextRequest) {
  const session = await getApiSession(AccountType.ADMIN);
  if (!session) return NextResponse.json({ error: "admin_session_required" }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_invitation" }, { status: 400 });

  const email = input.data.email.toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + INVITATION_HOURS * 60 * 60_000);
  try {
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.account.findUnique({ where: { email_type: { email, type: AccountType.ADMIN } } });
      if (existing?.state === AccountState.ACTIVE) throw new Error("account_active");
      const account = existing
        ? await tx.account.update({ where: { id: existing.id }, data: { state: AccountState.INVITED, passwordHash: null } })
        : await tx.account.create({ data: { email, type: AccountType.ADMIN, state: AccountState.INVITED } });
      const invite = await tx.accountInvite.upsert({ where: { accountId: account.id }, update: { tokenHash, expiresAt, status: InvitationStatus.PENDING, reason: input.data.reason, invitedByAccountId: session.accountId, usedAt: null, revokedAt: null, lastSentAt: new Date() }, create: { accountId: account.id, tokenHash, expiresAt, reason: input.data.reason, invitedByAccountId: session.accountId } });
      await tx.auditLog.create({ data: { adminId: session.accountId, action: "ADMIN_INVITED", targetType: "Account", targetId: account.id, reason: input.data.reason, metadata: { email } } });
      const delivery = await queueEmail(tx, { eventKey: `admin-invitation:${invite.id}:${tokenHash}`, to: email, recipientAccountId: account.id, subject: "Your NOVA administrator invitation", title: "You have been invited to NOVA administration", greeting: email, message: `${session.account.displayName || session.account.email} invited you to NOVA administration. Set your password using the secure invitation link before it expires.`, details: [`Reason: ${input.data.reason}`, `Expires: ${expiresAt.toLocaleString("en-GB", { timeZone: "Europe/Berlin" })}`], action: { label: "Activate administrator account", url: adminActivationUrl(request.nextUrl.origin, token) } });
      return { account, delivery };
    });
    return NextResponse.json({ id: result.account.id, expiresAt, delivery: result.delivery });
  } catch (error) {
    if (error instanceof Error && error.message === "account_active") return NextResponse.json({ error: "admin_account_already_active" }, { status: 409 });
    return NextResponse.json({ error: "invitation_creation_failed" }, { status: 503 });
  }
}
