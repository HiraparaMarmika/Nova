import { AccountType, BookingStatus, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { notify } from "@/domain/operations";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(AccountType.CUSTOMER); if (!session) return NextResponse.json({ error: "customer_session_required" }, { status: 401 });
  const id = (await params).id;
  try { const cancelled = await prisma.$transaction(async tx => { const booking = await tx.booking.findUnique({ where: { id }, include: { customer: true, cleaner: true, occurrences: { where: { startsAt: { gte: new Date() } } } } }); if (!booking || booking.customer.accountId !== session.accountId || !booking.recurrenceWeeks) throw new Error("not_found"); const cancellable: BookingStatus[] = [BookingStatus.REQUESTED, BookingStatus.ACCEPTED, BookingStatus.SCHEDULED]; const occurrences = booking.occurrences.filter(item => cancellable.includes(item.status)); for (const occurrence of occurrences) { await tx.occurrence.update({ where: { id: occurrence.id }, data: { status: BookingStatus.CANCELLED_BY_CUSTOMER } }); await tx.payment.updateMany({ where: { occurrenceId: occurrence.id, status: PaymentStatus.AUTHORIZED }, data: { status: PaymentStatus.RELEASED } }); await tx.lifecycleEvent.create({ data: { occurrenceId: occurrence.id, fromStatus: occurrence.status, toStatus: BookingStatus.CANCELLED_BY_CUSTOMER, actorId: session.accountId, reason: "Customer cancelled recurring series" } }); } await tx.booking.update({ where: { id }, data: { seriesActive: false, status: BookingStatus.CANCELLED_BY_CUSTOMER } }); if (booking.cleaner) await notify(tx, booking.cleaner.accountId, "SERIES_CANCELLED", "Recurring series cancelled", `${occurrences.length} future visit${occurrences.length === 1 ? "" : "s"} cancelled.`); return occurrences.length; }); return NextResponse.json({ cancelled }); }
  catch { return NextResponse.json({ error: "series_not_found" }, { status: 404 }); }
}
