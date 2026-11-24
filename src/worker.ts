import { BookingStatus, JobStatus, PaymentStatus, Prisma, PrismaClient } from "@prisma/client";
import { notify, settleOccurrence } from "@/domain/operations";
import { deliverQueuedEmail } from "@/lib/email";

const prisma = new PrismaClient();

async function processJob(job: { id: string; kind: string; payload: Prisma.JsonValue; attempts: number }) {
  if (job.kind === "SEND_EMAIL") {
    await deliverQueuedEmail(job.payload);
    await prisma.job.update({ where: { id: job.id }, data: { status: JobStatus.SUCCEEDED, attempts: { increment: 1 }, lastError: null } });
    return;
  }
  const payload = job.payload as { occurrenceId?: string };
  const occurrenceId = payload.occurrenceId;
  if (!occurrenceId) throw new Error("missing_occurrence_id");
  await prisma.$transaction(async tx => {
    if (job.kind === "EXPIRE_REQUEST") { const occurrence = await tx.occurrence.findUnique({ where: { id: occurrenceId }, include: { booking: { include: { customer: true, cleaner: true } } } }); if (occurrence?.status === BookingStatus.REQUESTED) { await tx.occurrence.update({ where: { id: occurrence.id }, data: { status: BookingStatus.EXPIRED } }); await tx.payment.updateMany({ where: { occurrenceId: occurrence.id, status: PaymentStatus.AUTHORIZED }, data: { status: PaymentStatus.RELEASED } }); await tx.lifecycleEvent.create({ data: { occurrenceId: occurrence.id, fromStatus: BookingStatus.REQUESTED, toStatus: BookingStatus.EXPIRED, actorId: "system", reason: "Request response window expired" } }); await notify(tx, occurrence.booking.customer.accountId, "REQUEST_EXPIRED", "Booking request expired", "The cleaner did not respond in time. Your demo authorization was released."); } }
    else if (job.kind === "SETTLE_OCCURRENCE") await settleOccurrence(tx, occurrenceId, "system");
    else if (job.kind === "REMINDER_VISIT") { const occurrence = await tx.occurrence.findUnique({ where: { id: occurrenceId }, include: { booking: { include: { customer: true, cleaner: true } } } }); const reminderStatuses: BookingStatus[] = [BookingStatus.ACCEPTED, BookingStatus.SCHEDULED]; if (occurrence && reminderStatuses.includes(occurrence.status)) { await notify(tx, occurrence.booking.customer.accountId, "REMINDER", "Upcoming NOVA visit", `Your visit starts at ${occurrence.localStart}.`); if (occurrence.booking.cleaner) await notify(tx, occurrence.booking.cleaner.accountId, "REMINDER", "Upcoming NOVA job", `Your job starts at ${occurrence.localStart}.`); } }
    await tx.job.update({ where: { id: job.id }, data: { status: JobStatus.SUCCEEDED, attempts: { increment: 1 }, lastError: null } });
  });
}

async function run() { const jobs = await prisma.job.findMany({ where: { status: { in: [JobStatus.QUEUED, JobStatus.RETRY] }, runAt: { lte: new Date() } }, orderBy: { runAt: "asc" }, take: 20 }); for (const job of jobs) { try { await prisma.job.update({ where: { id: job.id }, data: { status: JobStatus.RUNNING } }); await processJob(job); } catch (error) { const attempts = job.attempts + 1; await prisma.job.update({ where: { id: job.id }, data: { status: attempts >= 5 ? JobStatus.FAILED : JobStatus.RETRY, attempts, lastError: error instanceof Error ? error.message.slice(0, 1000) : "Unknown worker error", runAt: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000) } }); } } console.log(`NOVA worker processed ${jobs.length} jobs`); }
run().finally(() => prisma.$disconnect());
