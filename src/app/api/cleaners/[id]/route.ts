import { AccountState, AccountType, OnboardingStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { sendCleanerApprovalEmail } from "@/lib/email";

const inputSchema = z.object({ onboarding: z.enum(["APPROVED", "REJECTED", "NEEDS_CHANGES"]), reason: z.string().trim().min(3).max(500) });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(AccountType.ADMIN); if (!session) return NextResponse.json({ error: "admin_session_required" }, { status: 401 });
  const input = inputSchema.safeParse(await request.json().catch(() => null)); if (!input.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const onboarding = input.data.onboarding as OnboardingStatus; const id = (await params).id;
  try {
    const cleaner = await prisma.$transaction(async tx => {
      const updated = await tx.cleaner.update({ where: { id }, data: { onboarding, connectPayoutsEnabled: onboarding === OnboardingStatus.APPROVED }, include: { account: true } });
      await tx.account.update({ where: { id: updated.accountId }, data: { state: onboarding === OnboardingStatus.APPROVED ? AccountState.ACTIVE : AccountState.RESTRICTED } });
      if (onboarding !== OnboardingStatus.APPROVED) await tx.session.deleteMany({ where: { accountId: updated.accountId } });
      await tx.auditLog.create({ data: { adminId: session.accountId, action: `CLEANER_${onboarding}`, targetType: "Cleaner", targetId: id, reason: input.data.reason, metadata: { accountId: updated.accountId, email: updated.account.email } } });
      await tx.notification.create({ data: { accountId: updated.accountId, kind: "APPLICATION_REVIEW", subject: `Application ${onboarding.toLowerCase().replaceAll("_", " ")}`, body: onboarding === OnboardingStatus.APPROVED ? "Your cleaner application has been approved. You can now sign in and manage your profile." : input.data.reason } });
      return updated;
    });
    let emailDelivery: { delivered: boolean; reason?: string } = { delivered: false, reason: "not_required" };
    if (onboarding === OnboardingStatus.APPROVED) {
      try { emailDelivery = await sendCleanerApprovalEmail({ to: cleaner.account.email, name: cleaner.name, loginUrl: new URL("/cleaner/sign-in", process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).toString() }); }
      catch { emailDelivery = { delivered: false, reason: "email_delivery_failed" }; }
    }
    return NextResponse.json({ id: cleaner.id, onboarding: cleaner.onboarding, accountState: onboarding === OnboardingStatus.APPROVED ? AccountState.ACTIVE : AccountState.RESTRICTED, emailDelivery });
  } catch { return NextResponse.json({ error: "cleaner_update_failed" }, { status: 404 }); }
}
