import { AccountState, AccountType, OnboardingStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { queueAccountEmail } from "@/lib/email";
import { appUrl } from "@/domain/operations";

const inputSchema = z.object({ onboarding: z.enum(["APPROVED", "REJECTED", "NEEDS_CHANGES"]), reason: z.string().trim().min(3).max(500) });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(AccountType.ADMIN); if (!session) return NextResponse.json({ error: "admin_session_required" }, { status: 401 });
  const input = inputSchema.safeParse(await request.json().catch(() => null)); if (!input.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const onboarding = input.data.onboarding as OnboardingStatus; const id = (await params).id;
  try {
    const result = await prisma.$transaction(async tx => {
      const current = await tx.cleaner.findUnique({ where: { id }, include: { account: true } });
      if (!current) throw new Error("not_found");
      if (current.onboarding === onboarding) return { cleaner: current, changed: false };
      if (![OnboardingStatus.SUBMITTED, OnboardingStatus.UNDER_REVIEW, OnboardingStatus.NEEDS_CHANGES].includes(current.onboarding)) throw new Error("already_decided");
      const updated = await tx.cleaner.update({ where: { id }, data: { onboarding, connectPayoutsEnabled: onboarding === OnboardingStatus.APPROVED }, include: { account: true } });
      await tx.account.update({ where: { id: updated.accountId }, data: { state: onboarding === OnboardingStatus.APPROVED ? AccountState.ACTIVE : AccountState.RESTRICTED } });
      if (onboarding !== OnboardingStatus.APPROVED) await tx.session.deleteMany({ where: { accountId: updated.accountId } });
      await tx.auditLog.create({ data: { adminId: session.accountId, action: `CLEANER_${onboarding}`, targetType: "Cleaner", targetId: id, reason: input.data.reason, metadata: { accountId: updated.accountId, email: updated.account.email } } });
      await tx.notification.create({ data: { accountId: updated.accountId, kind: "APPLICATION_REVIEW", subject: `Application ${onboarding.toLowerCase().replaceAll("_", " ")}`, body: onboarding === OnboardingStatus.APPROVED ? "Your cleaner application has been approved. You can now sign in and manage your profile." : input.data.reason } });
      if (onboarding === OnboardingStatus.APPROVED) await queueAccountEmail(tx, { accountId: updated.accountId, eventKey: `cleaner-approval:${updated.id}`, subject: "Your NOVA Cleaner Application Has Been Approved!", title: "Your cleaner application is approved", greeting: updated.name, message: "Congratulations! Your NOVA cleaner application has been approved. You can now sign in with your registered email address and password to manage your profile and availability.", action: { label: "Sign in to your Cleaner Portal", url: appUrl("/cleaner/sign-in") } });
      return { cleaner: updated, changed: true };
    });
    return NextResponse.json({ id: result.cleaner.id, onboarding: result.cleaner.onboarding, accountState: result.cleaner.account.state, changed: result.changed, emailQueued: result.changed && onboarding === OnboardingStatus.APPROVED });
  } catch (error) { if (error instanceof Error && error.message === "not_found") return NextResponse.json({ error: "cleaner_not_found" }, { status: 404 }); if (error instanceof Error && error.message === "already_decided") return NextResponse.json({ error: "cleaner_already_decided" }, { status: 409 }); return NextResponse.json({ error: "cleaner_update_failed" }, { status: 409 }); }
}
