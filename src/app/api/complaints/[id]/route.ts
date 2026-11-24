import { AccountType, BookingStatus, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { notify, settleOccurrence } from "@/domain/operations";

const schema = z.object({ resolution: z.string().trim().min(5).max(1000), outcome: z.enum(["SETTLE", "FULL_REFUND", "RELEASE", "NO_ACTION"]) });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(AccountType.ADMIN); if (!session) return NextResponse.json({ error: "admin_session_required" }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null)); if (!input.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const id = (await params).id;
  try { const complaint = await prisma.$transaction(async tx => { const current = await tx.complaint.findUniqueOrThrow({ where: { id }, include: { occurrence: { include: { booking: { include: { customer: true, cleaner: true } }, payment: true } } } }); const occurrence = current.occurrence;
    const settleable: BookingStatus[] = [BookingStatus.DISPUTED, BookingStatus.CONFIRMED];
    if (input.data.outcome === "SETTLE" || input.data.outcome === "NO_ACTION") { if (settleable.includes(occurrence.status)) await settleOccurrence(tx, occurrence.id, session.accountId); }
    if (input.data.outcome === "RELEASE") { await tx.payment.updateMany({ where: { occurrenceId: occurrence.id, status: PaymentStatus.AUTHORIZED }, data: { status: PaymentStatus.RELEASED } }); if (occurrence.status === BookingStatus.DISPUTED) { await tx.occurrence.update({ where: { id: occurrence.id }, data: { status: BookingStatus.CANCELLED_BY_ADMIN } }); await tx.lifecycleEvent.create({ data: { occurrenceId: occurrence.id, fromStatus: occurrence.status, toStatus: BookingStatus.CANCELLED_BY_ADMIN, actorId: session.accountId, reason: input.data.resolution } }); } }
    if (input.data.outcome === "FULL_REFUND" && occurrence.payment) { if (occurrence.payment.capturedCents > 0) { await tx.refund.create({ data: { paymentId: occurrence.payment.id, amountCents: occurrence.payment.capturedCents, reason: input.data.resolution, providerReference: `demo_refund_${occurrence.payment.id}_${Date.now()}` } }); await tx.payment.update({ where: { id: occurrence.payment.id }, data: { status: PaymentStatus.REFUNDED } }); } else await tx.payment.update({ where: { id: occurrence.payment.id }, data: { status: PaymentStatus.RELEASED } }); await tx.payout.updateMany({ where: { occurrenceId: occurrence.id }, data: { status: "DEMO_REVERSED" } }); if (occurrence.status === BookingStatus.DISPUTED) { await tx.occurrence.update({ where: { id: occurrence.id }, data: { status: BookingStatus.CANCELLED_BY_ADMIN } }); await tx.lifecycleEvent.create({ data: { occurrenceId: occurrence.id, fromStatus: occurrence.status, toStatus: BookingStatus.CANCELLED_BY_ADMIN, actorId: session.accountId, reason: input.data.resolution } }); } }
    const updated = await tx.complaint.update({ where: { id }, data: { status: "RESOLVED", resolution: `${input.data.outcome}: ${input.data.resolution}`, resolvedAt: new Date() } }); await tx.auditLog.create({ data: { adminId: session.accountId, action: `COMPLAINT_${input.data.outcome}`, targetType: "Complaint", targetId: id, reason: input.data.resolution } }); await notify(tx, occurrence.booking.customer.accountId, "COMPLAINT_RESOLVED", "Support case resolved", input.data.resolution); if (occurrence.booking.cleaner) await notify(tx, occurrence.booking.cleaner.accountId, "COMPLAINT_RESOLVED", "Support case resolved", input.data.resolution); return updated; }); return NextResponse.json({ id: complaint.id }); }
  catch { return NextResponse.json({ error: "resolution_failed" }, { status: 409 }); }
}
