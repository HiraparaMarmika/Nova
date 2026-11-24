import { AccountState, OnboardingStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cleanerSlotAvailable, recurrenceDates } from "@/domain/scheduling";
import { coversPostcode } from "@/domain/coverage";

function displayName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest.map(part => `${part[0]}.`).join(" ")}` : first;
}

export async function GET(request: NextRequest) {
  const postcode = request.nextUrl.searchParams.get("postcode");
  const validPostcode = postcode && /^\d{5}$/.test(postcode) ? postcode : null;
  const rawStart = request.nextUrl.searchParams.get("startsAt");
  const startsAt = rawStart ? new Date(rawStart) : null;
  const durationMinutes = Number(request.nextUrl.searchParams.get("durationMinutes") ?? 0);
  const rawRecurrenceWeeks = Number(request.nextUrl.searchParams.get("recurrenceWeeks") ?? 0);
  const recurrenceWeeks = Number.isInteger(rawRecurrenceWeeks) && rawRecurrenceWeeks >= 1 && rawRecurrenceWeeks <= 4 ? rawRecurrenceWeeks : null;
  const cleaners = await prisma.$transaction(async tx => {
    const candidates = await tx.cleaner.findMany({
      where: { account: { state: AccountState.ACTIVE }, onboarding: OnboardingStatus.APPROVED, connectPayoutsEnabled: true, acceptingBookings: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, hourlyRateCents: true, basePostcode: true, serviceRadiusKm: true, areas: { select: { postcodePrefix: true }, orderBy: { postcodePrefix: "asc" } }, bookings: { select: { occurrences: { select: { review: { select: { rating: true } } } } } } },
    });
    if (validPostcode) {
      const postcodes = [...new Set([validPostcode, ...candidates.flatMap(cleaner => cleaner.basePostcode ? [cleaner.basePostcode] : [])])];
      const locations = await tx.postcodeLocation.findMany({ where: { postcode: { in: postcodes } } });
      const locationByPostcode = new Map(locations.map(location => [location.postcode, location]));
      const covered = candidates.filter(cleaner => coversPostcode({
        bookingPostcode: validPostcode,
        explicitPrefixes: cleaner.areas.map(area => area.postcodePrefix),
        basePostcode: cleaner.basePostcode,
        radiusKm: cleaner.serviceRadiusKm,
        bookingLocation: locationByPostcode.get(validPostcode),
        baseLocation: cleaner.basePostcode ? locationByPostcode.get(cleaner.basePostcode) : undefined,
      }));
      candidates.splice(0, candidates.length, ...covered);
    }
    if (!startsAt || Number.isNaN(startsAt.valueOf()) || durationMinutes < 60) return candidates;
    const dates = recurrenceDates(startsAt, recurrenceWeeks);
    const availability = await Promise.all(candidates.map(async cleaner => {
      for (const occurrenceStart of dates) {
        if (!await cleanerSlotAvailable(tx, { cleanerId: cleaner.id, startsAt: occurrenceStart, durationMinutes })) return { cleaner, available: false };
      }
      return { cleaner, available: true };
    }));
    return availability.filter(item => item.available).map(item => item.cleaner);
  });
  const profiles = cleaners.map(cleaner => {
    const ratings = cleaner.bookings.flatMap(booking => booking.occurrences.flatMap(occurrence => occurrence.review ? [occurrence.review.rating] : []));
    return { id: cleaner.id, name: displayName(cleaner.name), rate: cleaner.hourlyRateCents, areas: cleaner.areas.map(area => area.postcodePrefix), rating: ratings.length ? (ratings.reduce((total, value) => total + value, 0) / ratings.length).toFixed(1) : null };
  });
  return NextResponse.json({ profiles }, { headers: { "Cache-Control": "no-store" } });
}
