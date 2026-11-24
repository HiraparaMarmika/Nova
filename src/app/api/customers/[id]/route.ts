import { AccountState, AccountType, CustomerApprovalStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { queueAccountEmail } from "@/lib/email";
import { appUrl } from "@/domain/operations";

const inputSchema = z.object({ approvalStatus: z.enum(["APPROVED", "REJECTED", "NEEDS_CHANGES"]), reason: z.string().trim().min(3).max(500) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(AccountType.ADMIN);
  if (!session) return NextResponse.json({ error: "admin_session_required" }, { status: 401 });
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const id = (await params).id;
  const approvalStatus = input.data.approvalStatus as CustomerApprovalStatus;
  try {
    const result = await prisma.$transaction(async tx => {
      const current = await tx.customer.findUnique({ where: { id }, include: { account: true } });
      if (!current) throw new Error("not_found");
      if (current.approvalStatus === approvalStatus) return { customer: current, changed: false };
      if (![CustomerApprovalStatus.PENDING, CustomerApprovalStatus.NEEDS_CHANGES].includes(current.approvalStatus)) throw new Error("already_decided");

      const approved = approvalStatus === CustomerApprovalStatus.APPROVED;
      const customer = await tx.customer.update({ where: { id }, data: { approvalStatus }, include: { account: true } });
      await tx.account.update({ where: { id: customer.accountId }, data: { state: approved ? AccountState.ACTIVE : AccountState.RESTRICTED } });
      if (!approved) await tx.session.deleteMany({ where: { accountId: customer.accountId } });
      await tx.auditLog.create({ data: { adminId: session.accountId, action: `CUSTOMER_${approvalStatus}`, targetType: "Customer", targetId: customer.id, reason: input.data.reason, metadata: { accountId: customer.accountId, email: customer.account.email } } });
      await tx.notification.create({ data: { accountId: customer.accountId, kind: "CUSTOMER_APPLICATION_REVIEW", subject: `Customer account ${approvalStatus.toLowerCase().replaceAll("_", " ")}`, body: approved ? "Your NOVA customer account has been approved. You can now sign in and manage bookings." : input.data.reason } });
      if (approved) await queueAccountEmail(tx, { accountId: customer.accountId, eventKey: `customer-approval:${customer.id}`, subject: "Your NOVA Customer Account Has Been Approved!", title: "Your customer account is approved", greeting: customer.name, message: "Good news! Your NOVA customer account has been approved. You can now sign in with your registered email address and password to explore cleaning services and manage bookings.", action: { label: "Sign in to your customer portal", url: appUrl("/customer/sign-in") } });
      return { customer, changed: true };
    });
    return NextResponse.json({ id: result.customer.id, approvalStatus: result.customer.approvalStatus, accountState: result.customer.account.state, changed: result.changed, emailQueued: result.changed && approvalStatus === CustomerApprovalStatus.APPROVED });
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") return NextResponse.json({ error: "customer_not_found" }, { status: 404 });
    if (error instanceof Error && error.message === "already_decided") return NextResponse.json({ error: "customer_already_decided" }, { status: 409 });
    return NextResponse.json({ error: "customer_update_failed" }, { status: 409 });
  }
}
