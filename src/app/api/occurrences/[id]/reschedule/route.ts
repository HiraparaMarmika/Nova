import { AccountType, BookingStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { berlinLocalStamp, cleanerSlotAvailable } from "@/domain/scheduling";
import { notify } from "@/domain/operations";

const schema = z.object({ startsAt: z.string().datetime() });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(AccountType.CUSTOMER);
  if (!session) return NextResponse.json({ error: "customer_session_required" }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const startsAt = new Date(input.data.startsAt);
  if (startsAt <= new Date()) return NextResponse.json({ error: "invalid_start" }, { status: 400 });
  try {
    await prisma.$transaction(async tx => {
      const occurrence = await tx.occurrence.findUnique({ where: { id: (await params).id }, include: { booking: { include: { customer: true, cleaner: true } } } });
      if (!occurrence || occurrence.booking.customer.accountId !== session.accountId) throw new Error("forbidden");
      const reschedulable: BookingStatus[] = [BookingStatus.REQUESTED, BookingStatus.ACCEPTED, BookingStatus.SCHEDULED];
      if (!reschedulable.includes(occurrence.status) || !occurrence.booking.cleaner) throw new Error("cannot_reschedule");
      if (!await cleanerSlotAvailable(tx, { cleanerId: occurrence.booking.cleaner.id, startsAt, durationMinutes: occurrence.booking.durationMinutes, ignoreOccurrenceId: occurrence.id })) throw new Error("slot_unavailable");
      await tx.occurrence.update({ where: { id: occurrence.id }, data: { startsAt, localStart: berlinLocalStamp(startsAt) } });
      await tx.lifecycleEvent.create({ data: { occurrenceId: occurrence.id, fromStatus: occurrence.status, toStatus: occurrence.status, actorId: session.accountId, reason: `Rescheduled to ${berlinLocalStamp(startsAt)} Europe/Berlin` } });
      await notify(tx, occurrence.booking.cleaner.accountId, "RESCHEDULED", "Visit rescheduled", `A customer moved a visit to ${berlinLocalStamp(startsAt)}.`);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "reschedule_failed";
    const status = message === "forbidden" ? 403 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
