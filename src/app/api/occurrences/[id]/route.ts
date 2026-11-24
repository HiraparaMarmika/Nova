import { AccountType, BookingStatus, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { assertTransition, type VisitStatus } from "@/domain/lifecycle";
import { notify, settleOccurrence } from "@/domain/operations";

const inputSchema = z.object({ status: z.nativeEnum(BookingStatus), reason: z.string().trim().max(500).optional() });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(); if (!session) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const input = inputSchema.safeParse(await request.json().catch(() => null)); if (!input.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const occurrence = await prisma.occurrence.findUnique({ where: { id: (await params).id }, include: { booking: { include: { customer: true, cleaner: true } } } });
  if (!occurrence) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const target = input.data.status;
  const customerTargets: BookingStatus[] = [BookingStatus.CANCELLED_BY_CUSTOMER, BookingStatus.CONFIRMED];
  const cleanerTargets: BookingStatus[] = [BookingStatus.ACCEPTED, BookingStatus.DECLINED, BookingStatus.SCHEDULED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED, BookingStatus.CANCELLED_BY_CLEANER, BookingStatus.NO_SHOW];
  const customerOwns = session.scope === AccountType.CUSTOMER && occurrence.booking.customer.accountId === session.accountId && customerTargets.includes(target);
  const cleanerOwns = session.scope === AccountType.CLEANER && occurrence.booking.cleaner?.accountId === session.accountId && cleanerTargets.includes(target);
  const adminOwns = session.scope === AccountType.ADMIN;
  if (!customerOwns && !cleanerOwns && !adminOwns) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (adminOwns && (!input.data.reason || input.data.reason.length < 3)) return NextResponse.json({ error: "admin_reason_required" }, { status: 400 });
  try { assertTransition(occurrence.status as VisitStatus, target as VisitStatus); } catch { return NextResponse.json({ error: "invalid_transition" }, { status: 409 }); }
  await prisma.$transaction(async tx => {
    if (target === BookingStatus.SETTLED) { await settleOccurrence(tx, occurrence.id, session.accountId); return; }
    await tx.occurrence.update({ where: { id: occurrence.id }, data: { status: target, ...(target === BookingStatus.CONFIRMED ? { confirmedAt: new Date() } : {}) } });
    if (!occurrence.booking.recurrenceWeeks) await tx.booking.update({ where: { id: occurrence.bookingId }, data: { status: target } });
    await tx.lifecycleEvent.create({ data: { occurrenceId: occurrence.id, fromStatus: occurrence.status, toStatus: target, actorId: session.accountId, reason: input.data.reason } });
    const releaseStatuses: BookingStatus[] = [BookingStatus.DECLINED, BookingStatus.CANCELLED_BY_CUSTOMER, BookingStatus.CANCELLED_BY_CLEANER, BookingStatus.CANCELLED_BY_ADMIN];
    if (releaseStatuses.includes(target)) {
      const config = await tx.appConfig.findFirst({ where: { key: "operations" }, orderBy: { version: "desc" } });
      const policy = config?.value as { cancellationNoticeHours?: number; lateCancellationFeeBps?: number } | null;
      const lateCustomerCancellation = target === BookingStatus.CANCELLED_BY_CUSTOMER && occurrence.startsAt.getTime() - Date.now() < (policy?.cancellationNoticeHours ?? 24) * 60 * 60_000;
      const payment = await tx.payment.findUnique({ where: { occurrenceId: occurrence.id } });
      if (lateCustomerCancellation && payment?.status === PaymentStatus.AUTHORIZED) { const capturedCents = Math.round(payment.authorizedCents * (policy?.lateCancellationFeeBps ?? 2500) / 10000); await tx.payment.update({ where: { occurrenceId: occurrence.id }, data: { status: PaymentStatus.CAPTURED, capturedCents } }); await tx.invoice.upsert({ where: { occurrenceId: occurrence.id }, update: { amountCents: capturedCents }, create: { occurrenceId: occurrence.id, number: `NOVA-CANCEL-${occurrence.id.slice(-8).toUpperCase()}`, amountCents: capturedCents } }); }
      else await tx.payment.updateMany({ where: { occurrenceId: occurrence.id, status: PaymentStatus.AUTHORIZED }, data: { status: PaymentStatus.RELEASED } });
    }
    if (target === BookingStatus.ACCEPTED && occurrence.booking.cleaner) { await notify(tx, occurrence.booking.customer.accountId, "BOOKING_ACCEPTED", "Cleaner accepted your request", `${occurrence.booking.cleaner.name} accepted the visit.`); await notify(tx, occurrence.booking.cleaner.accountId, "BOOKING_ACCEPTED", "Request accepted", "The visit is ready to be scheduled."); }
    if (target === BookingStatus.DECLINED && occurrence.booking.cleaner) await notify(tx, occurrence.booking.customer.accountId, "BOOKING_DECLINED", "Cleaner declined the request", "Your demo authorization was released. Choose another available cleaner.");
    if (target === BookingStatus.COMPLETED) await notify(tx, occurrence.booking.customer.accountId, "SERVICE_COMPLETED", "Service marked complete", "Confirm the completed visit or open a support case.");
    if (target === BookingStatus.CONFIRMED) { const config = await tx.appConfig.findFirst({ where: { key: "operations" }, orderBy: { version: "desc" } }); const value = config?.value as { complaintWindowHours?: number } | null; const hours = value?.complaintWindowHours ?? 48; await tx.job.upsert({ where: { dedupeKey: `settle-${occurrence.id}` }, update: { status: "QUEUED", runAt: new Date(Date.now() + hours * 60 * 60_000) }, create: { kind: "SETTLE_OCCURRENCE", dedupeKey: `settle-${occurrence.id}`, payload: { occurrenceId: occurrence.id }, runAt: new Date(Date.now() + hours * 60 * 60_000) } }); }
    if ((target === BookingStatus.SCHEDULED || target === BookingStatus.IN_PROGRESS) && occurrence.booking.cleaner) {
      const label = target === BookingStatus.SCHEDULED ? "scheduled" : "in progress";
      await notify(tx, occurrence.booking.customer.accountId, "BOOKING_STATUS", "Booking status updated", `Your booking with ${occurrence.booking.cleaner.name} is now ${label}.`);
    }
    if (releaseStatuses.includes(target) && occurrence.booking.cleaner) { await notify(tx, occurrence.booking.customer.accountId, "VISIT_CANCELLED", "Visit cancelled", `The visit is now ${target.toLowerCase().replaceAll("_", " ")}.`); await notify(tx, occurrence.booking.cleaner.accountId, "VISIT_CANCELLED", "Visit cancelled", `The visit is now ${target.toLowerCase().replaceAll("_", " ")}.`); }
    const admins = await tx.account.findMany({ where: { type: AccountType.ADMIN, state: "ACTIVE" }, select: { id: true } });
    if (admins.length) await tx.notification.createMany({ data: admins.map(admin => ({ accountId: admin.id, kind: "BOOKING_STATUS", subject: "Booking status updated", body: `Booking ${occurrence.bookingId} moved from ${occurrence.status.toLowerCase().replaceAll("_", " ")} to ${target.toLowerCase().replaceAll("_", " ")}.` })) });
    if (adminOwns) await tx.auditLog.create({ data: { adminId: session.accountId, action: `OCCURRENCE_${target}`, targetType: "Occurrence", targetId: occurrence.id, reason: input.data.reason! } });
  });
  return NextResponse.json({ ok: true, status: target });
}
