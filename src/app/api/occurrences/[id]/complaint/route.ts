import { AccountType, BookingStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { notify } from "@/domain/operations";

const schema = z.object({ reason: z.string().trim().min(10).max(1000) });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(AccountType.CUSTOMER); if (!session) return NextResponse.json({ error: "customer_session_required" }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null)); if (!input.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const id = (await params).id;
  try { const complaint = await prisma.$transaction(async tx => { const occurrence = await tx.occurrence.findUnique({ where: { id }, include: { booking: { include: { customer: true, cleaner: true } } } }); if (!occurrence || occurrence.booking.customer.accountId !== session.accountId) throw new Error("forbidden"); const updated = await tx.complaint.upsert({ where: { occurrenceId: occurrence.id }, update: { reason: input.data.reason, status: "OPEN", resolvedAt: null, resolution: null }, create: { occurrenceId: occurrence.id, reason: input.data.reason } }); const disputable: BookingStatus[] = [BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED, BookingStatus.CONFIRMED]; if (disputable.includes(occurrence.status)) { await tx.occurrence.update({ where: { id: occurrence.id }, data: { status: BookingStatus.DISPUTED } }); if (!occurrence.booking.recurrenceWeeks) await tx.booking.update({ where: { id: occurrence.bookingId }, data: { status: BookingStatus.DISPUTED } }); await tx.lifecycleEvent.create({ data: { occurrenceId: occurrence.id, fromStatus: occurrence.status, toStatus: BookingStatus.DISPUTED, actorId: session.accountId, reason: input.data.reason } }); } const admins = await tx.account.findMany({ where: { type: AccountType.ADMIN, state: "ACTIVE" }, select: { id: true } }); if (admins.length) await tx.notification.createMany({ data: admins.map(admin => ({ accountId: admin.id, kind: "COMPLAINT", subject: "New support case", body: `${occurrence.booking.customer.name} opened a case: ${input.data.reason}` })) }); if (occurrence.booking.cleaner) await notify(tx, occurrence.booking.cleaner.accountId, "COMPLAINT", "A support case was opened", "The admin team will review the visit and record an outcome."); return updated; }); return NextResponse.json({ id: complaint.id }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "complaint_failed" }, { status: 403 }); }
}
