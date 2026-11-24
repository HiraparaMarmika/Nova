import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import { queueAccountEmail } from "@/lib/email";

export async function notify(tx: Prisma.TransactionClient, accountId: string, kind: string, subject: string, body: string) {
  await tx.notification.create({ data: { accountId, kind, subject, body } });
}

export function appUrl(path: string) {
  return new URL(path, process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").toString();
}

export async function settleOccurrence(tx: Prisma.TransactionClient, occurrenceId: string, actorId: string) {
  const occurrence = await tx.occurrence.findUniqueOrThrow({
    where: { id: occurrenceId },
    include: { booking: { include: { cleaner: true, customer: true } }, financial: true, payment: true },
  });
  const settleable: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.DISPUTED];
  if (!settleable.includes(occurrence.status)) throw new Error("occurrence_not_settleable");
  if (!occurrence.financial || !occurrence.booking.cleaner) throw new Error("financial_snapshot_missing");
  if (occurrence.payment?.status === PaymentStatus.AUTHORIZED) await tx.payment.update({ where: { occurrenceId }, data: { status: PaymentStatus.CAPTURED, capturedCents: occurrence.payment.authorizedCents } });
  await tx.occurrence.update({ where: { id: occurrenceId }, data: { status: BookingStatus.SETTLED, settledAt: new Date() } });
  await tx.lifecycleEvent.create({ data: { occurrenceId, fromStatus: occurrence.status, toStatus: BookingStatus.SETTLED, actorId, reason: "Demo settlement completed" } });
  await tx.invoice.upsert({ where: { occurrenceId }, update: {}, create: { occurrenceId, number: `NOVA-${new Date().getFullYear()}-${occurrenceId.slice(-8).toUpperCase()}`, amountCents: occurrence.financial.grossCents } });
  await tx.payout.upsert({ where: { occurrenceId }, update: {}, create: { occurrenceId, cleanerId: occurrence.booking.cleaner.id, amountCents: occurrence.financial.cleanerNetCents } });
  const relationship = await tx.relationship.upsert({
    where: { customerId_cleanerId: { customerId: occurrence.booking.customer.id, cleanerId: occurrence.booking.cleaner.id } },
    update: occurrence.booking.recurrenceWeeks ? { recurringCompletedCount: { increment: 1 } } : {},
    create: { customerId: occurrence.booking.customer.id, cleanerId: occurrence.booking.cleaner.id, recurringCompletedCount: occurrence.booking.recurrenceWeeks ? 1 : 0 },
  });
  await notify(tx, occurrence.booking.customer.accountId, "INVOICE", "Invoice issued", "Your completed NOVA visit has been settled and its invoice is ready.");
  await queueAccountEmail(tx, { accountId: occurrence.booking.customer.accountId, eventKey: "payment-captured:" + occurrence.id + ":customer", subject: "Your NOVA payment and invoice", title: "Your visit has been settled", message: "Your completed visit has been settled and your invoice is ready.", details: ["Booking reference: " + occurrence.bookingId, "Amount paid: EUR " + (occurrence.financial.grossCents / 100).toFixed(2), "Status: captured"], action: { label: "View your visits", url: appUrl("/customer/invoices") } });
  await queueAccountEmail(tx, { accountId: occurrence.booking.cleaner.accountId, eventKey: "payout-prepared:" + occurrence.id + ":cleaner", subject: "Your NOVA payout is prepared", title: "Your payout is prepared", message: "The completed visit has been settled and a payout record is ready.", details: ["Booking reference: " + occurrence.bookingId, "Amount: EUR " + (occurrence.financial.cleanerNetCents / 100).toFixed(2)], action: { label: "View earnings", url: appUrl("/cleaner/earnings") } });
  await notify(tx, occurrence.booking.cleaner.accountId, "PAYOUT", "Demo payout prepared", `A demo payout for this visit is ready. Recurring completion count: ${relationship.recurringCompletedCount}.`);
}
