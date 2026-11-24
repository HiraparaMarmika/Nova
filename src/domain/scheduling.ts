import { BookingStatus, Prisma } from "@prisma/client";

export const blockingStatuses: BookingStatus[] = [BookingStatus.REQUESTED, BookingStatus.ACCEPTED, BookingStatus.SCHEDULED, BookingStatus.IN_PROGRESS, BookingStatus.CONFIRMED, BookingStatus.DISPUTED];

function berlinParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

export function berlinLocalStamp(date: Date) {
  const part = berlinParts(date);
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`;
}

export function berlinLocalToUtc(dateValue: string, timeValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) throw new Error("invalid_berlin_time");
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let result = new Date(desired);
  for (let attempt = 0; attempt < 3; attempt++) {
    const part = berlinParts(result);
    const represented = Date.UTC(Number(part.year), Number(part.month) - 1, Number(part.day), Number(part.hour), Number(part.minute));
    result = new Date(result.getTime() + desired - represented);
  }
  if (berlinLocalStamp(result) !== `${dateValue}T${timeValue}`) throw new Error("invalid_berlin_time");
  return result;
}

function weekdayNumber(value: string) {
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[value];
}

function minutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

export function isValidAvailability(ranges: { weekday: number; startsAt: string; endsAt: string }[]) {
  if (ranges.length < 1 || ranges.length > 14) return false;
  const grouped = new Map<number, Array<{ startsAt: number; endsAt: number }>>();
  for (const range of ranges) {
    if (!Number.isInteger(range.weekday) || range.weekday < 0 || range.weekday > 6) return false;
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(range.startsAt) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(range.endsAt)) return false;
    const start = minutes(range.startsAt);
    const end = minutes(range.endsAt);
    if (start >= end) return false;
    const day = grouped.get(range.weekday) ?? [];
    if (day.some(existing => start < existing.endsAt && end > existing.startsAt)) return false;
    day.push({ startsAt: start, endsAt: end });
    grouped.set(range.weekday, day);
  }
  return true;
}

export async function lockCleanerSchedule(tx: Prisma.TransactionClient, cleanerId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Cleaner" WHERE "id" = ${cleanerId} FOR UPDATE`;
}

export async function getAvailabilityConflicts(tx: Prisma.TransactionClient, cleanerId: string, ranges: { weekday: number; startsAt: string; endsAt: string }[]) {
  const occurrences = await tx.occurrence.findMany({
    where: { booking: { cleanerId }, status: { in: blockingStatuses }, startsAt: { gte: new Date() } },
    include: { booking: { select: { durationMinutes: true } } },
    orderBy: { startsAt: "asc" },
  });
  return occurrences.filter(occurrence => {
    const start = berlinParts(occurrence.startsAt);
    const end = berlinParts(new Date(occurrence.startsAt.getTime() + occurrence.booking.durationMinutes * 60_000));
    if (`${start.year}-${start.month}-${start.day}` !== `${end.year}-${end.month}-${end.day}`) return true;
    const startMinute = minutes(`${start.hour}:${start.minute}`);
    const endMinute = minutes(`${end.hour}:${end.minute}`);
    return !ranges.some(range => range.weekday === weekdayNumber(start.weekday) && minutes(range.startsAt) <= startMinute && minutes(range.endsAt) >= endMinute);
  });
}

export async function getDateBlockConflicts(tx: Prisma.TransactionClient, cleanerId: string, date: string) {
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const start = berlinLocalToUtc(date, "00:00");
  const endDate = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDate.getUTCDate()).padStart(2, "0")}`;
  const end = berlinLocalToUtc(endDate, "00:00");
  return tx.occurrence.findMany({
    where: { booking: { cleanerId }, status: { in: blockingStatuses }, startsAt: { gte: start, lt: end } },
    include: { booking: { select: { durationMinutes: true } } },
    orderBy: { startsAt: "asc" },
  });
}

export async function cleanerSlotAvailable(tx: Prisma.TransactionClient, input: { cleanerId: string; startsAt: Date; durationMinutes: number; ignoreOccurrenceId?: string }) {
  const endsAt = new Date(input.startsAt.getTime() + input.durationMinutes * 60_000);
  const start = berlinParts(input.startsAt);
  const end = berlinParts(endsAt);
  if (`${start.year}-${start.month}-${start.day}` !== `${end.year}-${end.month}-${end.day}`) return false;
  const localDate = `${start.year}-${start.month}-${start.day}`;
  const block = await tx.availabilityBlock.findUnique({ where: { cleanerId_date: { cleanerId: input.cleanerId, date: new Date(`${localDate}T00:00:00.000Z`) } }, select: { id: true } });
  if (block) return false;
  const availability = await tx.availability.findMany({
    where: { cleanerId: input.cleanerId, weekday: weekdayNumber(start.weekday), active: true },
  });
  const slotStart = minutes(`${start.hour}:${start.minute}`);
  const slotEnd = minutes(`${end.hour}:${end.minute}`);
  if (!availability.some(range => minutes(range.startsAt) <= slotStart && minutes(range.endsAt) >= slotEnd)) return false;
  const candidates = await tx.occurrence.findMany({
    where: {
      id: input.ignoreOccurrenceId ? { not: input.ignoreOccurrenceId } : undefined,
      booking: { cleanerId: input.cleanerId }, status: { in: blockingStatuses },
      startsAt: { gte: new Date(input.startsAt.getTime() - 8 * 60 * 60_000), lt: endsAt },
    },
    include: { booking: { select: { durationMinutes: true } } },
  });
  return !candidates.some(item => new Date(item.startsAt.getTime() + item.booking.durationMinutes * 60_000) > input.startsAt);
}

export function recurrenceDates(first: Date, recurrenceWeeks: number | null, count = 8) {
  if (!recurrenceWeeks) return [first];
  const local = berlinParts(first);
  const baseDate = new Date(Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day)));
  return Array.from({ length: count }, (_, index) => {
    const occurrenceDate = new Date(baseDate);
    occurrenceDate.setUTCDate(occurrenceDate.getUTCDate() + index * recurrenceWeeks * 7);
    const dateValue = `${occurrenceDate.getUTCFullYear()}-${String(occurrenceDate.getUTCMonth() + 1).padStart(2, "0")}-${String(occurrenceDate.getUTCDate()).padStart(2, "0")}`;
    return berlinLocalToUtc(dateValue, `${local.hour}:${local.minute}`);
  });
}
