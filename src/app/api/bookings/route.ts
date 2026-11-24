import { AccountState, AccountType, BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { snapshotVisit } from "@/domain/booking";
import { berlinLocalStamp, cleanerSlotAvailable, lockCleanerSchedule, recurrenceDates } from "@/domain/scheduling";
import { notify } from "@/domain/operations";
import { coversPostcode } from "@/domain/coverage";

const inputSchema = z.object({ cleanerId: z.string().min(1), postcode: z.string().regex(/^\d{5}$/), startsAt: z.string().datetime(), durationMinutes: z.number().int().min(60).max(480), extras: z.array(z.enum(["oven", "windows"])).max(2), recurrenceWeeks: z.number().int().min(1).max(4).nullable(), consent: z.boolean() });

export async function POST(request: NextRequest) {
  const session = await getApiSession(AccountType.CUSTOMER);
  if (!session) return NextResponse.json({ error: "customer_session_required" }, { status: 401 });
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || (input.data.recurrenceWeeks && !input.data.consent)) return NextResponse.json({ error: "invalid_booking" }, { status: 400 });
  const startsAt = new Date(input.data.startsAt);
  if (Number.isNaN(startsAt.valueOf()) || startsAt <= new Date()) return NextResponse.json({ error: "invalid_start" }, { status: 400 });
  try {
    const result = await prisma.$transaction(async tx => {
      await lockCleanerSchedule(tx, input.data.cleanerId);
      const customer = await tx.customer.findUnique({ where: { accountId: session.accountId } });
      const cleaner = await tx.cleaner.findFirst({
        where: { id: input.data.cleanerId, account: { state: AccountState.ACTIVE }, onboarding: "APPROVED", connectPayoutsEnabled: true, acceptingBookings: true },
        include: { areas: true },
      });
      if (!customer || !cleaner) throw new Error("cleaner_unavailable");
      const postcodes = [...new Set([input.data.postcode, ...(cleaner.basePostcode ? [cleaner.basePostcode] : [])])];
      const locations = await tx.postcodeLocation.findMany({ where: { postcode: { in: postcodes } } });
      const locationByPostcode = new Map(locations.map(location => [location.postcode, location]));
      if (!coversPostcode({
        bookingPostcode: input.data.postcode,
        explicitPrefixes: cleaner.areas.map(area => area.postcodePrefix),
        basePostcode: cleaner.basePostcode,
        radiusKm: cleaner.serviceRadiusKm,
        bookingLocation: locationByPostcode.get(input.data.postcode),
        baseLocation: cleaner.basePostcode ? locationByPostcode.get(cleaner.basePostcode) : undefined,
      })) throw new Error("cleaner_unavailable");
      const config = await tx.appConfig.findFirst({ where: { key: "operations" }, orderBy: { version: "desc" } });
      const operations = config?.value as { requestExpiryHours?: number; recurringHorizonCount?: number } | null;
      const dates = recurrenceDates(startsAt, input.data.recurrenceWeeks, operations?.recurringHorizonCount ?? 8);
      for (const date of dates) if (!await cleanerSlotAvailable(tx, { cleanerId: cleaner.id, startsAt: date, durationMinutes: input.data.durationMinutes })) throw new Error("slot_unavailable");
      const consent = input.data.recurrenceWeeks ? await tx.consent.create({ data: { customerId: customer.id, termsVersion: "1.0", proof: { source: "booking-form", recurrenceWeeks: input.data.recurrenceWeeks, acceptedBy: session.accountId } as Prisma.InputJsonValue, mandateReference: `demo_consent_${Date.now()}` } }) : null;
      const booking = await tx.booking.create({ data: { customerId: customer.id, cleanerId: cleaner.id, postcode: input.data.postcode, durationMinutes: input.data.durationMinutes, extras: input.data.extras, recurrenceWeeks: input.data.recurrenceWeeks, consentId: consent?.id, status: BookingStatus.REQUESTED } });
      const relationship = await tx.relationship.findUnique({ where: { customerId_cleanerId: { customerId: customer.id, cleanerId: cleaner.id } } });
      const extrasCents = input.data.extras.length * 1200;
      let firstId = "";
      for (const [index, date] of dates.entries()) {
        const financial = snapshotVisit({ durationMinutes: input.data.durationMinutes, rateCents: cleaner.hourlyRateCents, extrasCents, recurring: Boolean(input.data.recurrenceWeeks), ordinal: (relationship?.recurringCompletedCount ?? 0) + index + 1, converted: relationship?.convertedFromOneTime ?? false });
        const occurrence = await tx.occurrence.create({ data: { bookingId: booking.id, startsAt: date, localStart: berlinLocalStamp(date), status: BookingStatus.REQUESTED } });
        if (!firstId) firstId = occurrence.id;
        await tx.financialSnapshot.create({ data: { occurrenceId: occurrence.id, durationMinutes: input.data.durationMinutes, rateCents: cleaner.hourlyRateCents, extrasCents, grossCents: financial.grossCents, commissionBps: financial.commissionBps, commissionCents: financial.commissionCents, cleanerNetCents: financial.cleanerNetCents, taxTreatment: "DEMO_NOT_TAX_ADVICE", ruleVersion: "commission-v1" } });
        await tx.payment.create({ data: { occurrenceId: occurrence.id, provider: "demo", providerReference: `demo_auth_${occurrence.id}`, status: PaymentStatus.AUTHORIZED, authorizedCents: financial.grossCents, idempotencyKey: `demo-booking-${occurrence.id}` } });
        await tx.lifecycleEvent.create({ data: { occurrenceId: occurrence.id, toStatus: BookingStatus.REQUESTED, actorId: session.accountId, reason: index ? "Recurring visit generated with explicit consent" : "Customer booking request" } });
        await tx.job.create({ data: { kind: "EXPIRE_REQUEST", dedupeKey: `expire-${occurrence.id}`, payload: { occurrenceId: occurrence.id }, runAt: new Date(Math.min(date.getTime() - 24 * 60 * 60_000, Date.now() + (operations?.requestExpiryHours ?? 24) * 60 * 60_000)) } });
        const reminderAt = new Date(date.getTime() - 24 * 60 * 60_000);
        if (reminderAt > new Date()) await tx.job.create({ data: { kind: "REMINDER_VISIT", dedupeKey: `reminder-${occurrence.id}`, payload: { occurrenceId: occurrence.id }, runAt: reminderAt } });
      }
      await notify(tx, cleaner.accountId, "BOOKING_REQUEST", "New booking request", `${dates.length} visit${dates.length === 1 ? "" : "s"} requested in ${input.data.postcode}.`);
      await notify(tx, customer.accountId, "BOOKING_CREATED", "Booking request created", `Your request was sent to ${cleaner.name}.`);
      const admins = await tx.account.findMany({ where: { type: AccountType.ADMIN, state: AccountState.ACTIVE }, select: { id: true } });
      if (admins.length) await tx.notification.createMany({ data: admins.map(admin => ({ accountId: admin.id, kind: "BOOKING_ASSIGNED", subject: "Booking assigned to cleaner", body: `${customer.name}'s booking was assigned to ${cleaner.name}.` })) });
      return { id: firstId, occurrences: dates.length };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "booking_failed";
      const serializationConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      return NextResponse.json({ error: ["cleaner_unavailable", "slot_unavailable"].includes(message) ? message : serializationConflict ? "slot_unavailable" : "booking_failed" }, { status: 409 });
  }
}
