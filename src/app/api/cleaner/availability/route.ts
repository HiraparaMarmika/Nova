import { AccountType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { berlinLocalStamp, getAvailabilityConflicts, getDateBlockConflicts, isValidAvailability, lockCleanerSchedule } from "@/domain/scheduling";

const rangeSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startsAt: z.string(),
  endsAt: z.string(),
});
const scheduleSchema = z.object({
  availability: z.array(rangeSchema).min(1).max(14),
  acceptingBookings: z.boolean(),
});
const blockSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(2).max(200),
});

export async function PATCH(request: NextRequest) {
  const session = await getApiSession(AccountType.CLEANER);
  if (!session) return NextResponse.json({ error: "cleaner_session_required" }, { status: 401 });
  const input = scheduleSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || !isValidAvailability(input.data.availability)) return NextResponse.json({ error: "invalid_availability" }, { status: 400 });

  const result = await prisma.$transaction(async tx => {
    const cleaner = await tx.cleaner.findUnique({ where: { accountId: session.accountId }, select: { id: true } });
    if (!cleaner) return { error: "cleaner_not_found" as const };
    await lockCleanerSchedule(tx, cleaner.id);
    const conflicts = await getAvailabilityConflicts(tx, cleaner.id, input.data.availability);
    if (conflicts.length) return {
      error: "availability_conflicts" as const,
      bookings: conflicts.map(item => ({ id: item.id, startsAt: item.startsAt.toISOString(), localStart: item.localStart, status: item.status })),
    };
    await tx.availability.deleteMany({ where: { cleanerId: cleaner.id } });
    await tx.availability.createMany({ data: input.data.availability.map(item => ({ cleanerId: cleaner.id, ...item })) });
    await tx.cleaner.update({ where: { id: cleaner.id }, data: { acceptingBookings: input.data.acceptingBookings } });
    return { ok: true as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if ("error" in result) return NextResponse.json(result, { status: result.error === "cleaner_not_found" ? 404 : 409 });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getApiSession(AccountType.CLEANER);
  if (!session) return NextResponse.json({ error: "cleaner_session_required" }, { status: 401 });
  const input = blockSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_date_block" }, { status: 400 });
  const currentDate = berlinLocalStamp(new Date()).slice(0, 10);
  let date: Date;
  try {
    if (input.data.date < currentDate) throw new Error("past_date");
    const parsedDate = new Date(`${input.data.date}T00:00:00.000Z`);
    if (parsedDate.toISOString().slice(0, 10) !== input.data.date) throw new Error("invalid_date");
    date = parsedDate;
  } catch {
    return NextResponse.json({ error: "invalid_date_block" }, { status: 400 });
  }

  const result = await prisma.$transaction(async tx => {
    const cleaner = await tx.cleaner.findUnique({ where: { accountId: session.accountId }, select: { id: true } });
    if (!cleaner) return { error: "cleaner_not_found" as const };
    await lockCleanerSchedule(tx, cleaner.id);
    const conflicts = await getDateBlockConflicts(tx, cleaner.id, input.data.date);
    if (conflicts.length) return {
      error: "availability_conflicts" as const,
      bookings: conflicts.map(item => ({ id: item.id, startsAt: item.startsAt.toISOString(), localStart: item.localStart, status: item.status })),
    };
    await tx.availabilityBlock.create({ data: { cleanerId: cleaner.id, date, reason: input.data.reason } });
    return { ok: true as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if ("error" in result) return NextResponse.json(result, { status: result.error === "cleaner_not_found" ? 404 : 409 });
  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getApiSession(AccountType.CLEANER);
  if (!session) return NextResponse.json({ error: "cleaner_session_required" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "invalid_date_block" }, { status: 400 });
  const cleaner = await prisma.cleaner.findUnique({ where: { accountId: session.accountId }, select: { id: true } });
  if (!cleaner) return NextResponse.json({ error: "cleaner_not_found" }, { status: 404 });
  await prisma.$transaction(async tx => {
    await lockCleanerSchedule(tx, cleaner.id);
    await tx.availabilityBlock.deleteMany({ where: { id, cleanerId: cleaner.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return NextResponse.json({ ok: true });
}
