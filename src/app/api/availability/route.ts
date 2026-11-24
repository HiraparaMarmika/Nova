import { AccountState, OnboardingStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { berlinLocalToUtc, cleanerSlotAvailable } from "@/domain/scheduling";
import { coversPostcode } from "@/domain/coverage";

export async function GET(request: NextRequest) {
  const postcode = request.nextUrl.searchParams.get("postcode") ?? "";
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const durationMinutes = Number(request.nextUrl.searchParams.get("durationMinutes") ?? 0);
  if (!/^\d{5}$/.test(postcode) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || ![120, 180, 240].includes(durationMinutes)) return NextResponse.json({ error: "invalid_availability_query" }, { status: 400 });

  let weekday: number;
  try {
    berlinLocalToUtc(date, "00:00");
    weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  } catch {
    return NextResponse.json({ error: "invalid_availability_query" }, { status: 400 });
  }

  const slots = await prisma.$transaction(async tx => {
    const cleaners = await tx.cleaner.findMany({
      where: { account: { state: AccountState.ACTIVE }, onboarding: OnboardingStatus.APPROVED, connectPayoutsEnabled: true, acceptingBookings: true },
      select: {
        id: true,
        basePostcode: true,
        serviceRadiusKm: true,
        areas: { select: { postcodePrefix: true } },
        availability: { where: { weekday, active: true }, select: { startsAt: true, endsAt: true } },
      },
    });
    const postcodes = [...new Set([postcode, ...cleaners.flatMap(cleaner => cleaner.basePostcode ? [cleaner.basePostcode] : [])])];
    const locations = await tx.postcodeLocation.findMany({ where: { postcode: { in: postcodes } } });
    const locationByPostcode = new Map(locations.map(location => [location.postcode, location]));
    const eligibleCleaners = cleaners.filter(cleaner => coversPostcode({
      bookingPostcode: postcode,
      explicitPrefixes: cleaner.areas.map(area => area.postcodePrefix),
      basePostcode: cleaner.basePostcode,
      radiusKm: cleaner.serviceRadiusKm,
      bookingLocation: locationByPostcode.get(postcode),
      baseLocation: cleaner.basePostcode ? locationByPostcode.get(cleaner.basePostcode) : undefined,
    }));

    const candidateTimes = new Set<number>();
    for (const cleaner of eligibleCleaners) {
      for (const range of cleaner.availability) {
        const [startHour, startMinute] = range.startsAt.split(":").map(Number);
        const [endHour, endMinute] = range.endsAt.split(":").map(Number);
        const rangeStart = startHour * 60 + startMinute;
        const rangeEnd = endHour * 60 + endMinute;
        for (let total = Math.ceil(rangeStart / 30) * 30; total + durationMinutes <= rangeEnd; total += 30) candidateTimes.add(total);
      }
    }

    const output: { time: string; startsAt: string; cleanerIds: string[] }[] = [];
    for (const total of [...candidateTimes].sort((a, b) => a - b)) {
      const time = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      const startsAt = berlinLocalToUtc(date, time);
      if (startsAt <= new Date()) continue;
      const checks = await Promise.all(eligibleCleaners.map(async cleaner => ({
        id: cleaner.id,
        available: await cleanerSlotAvailable(tx, { cleanerId: cleaner.id, startsAt, durationMinutes }),
      })));
      const cleanerIds = checks.filter(item => item.available).map(item => item.id);
      if (cleanerIds.length) output.push({ time, startsAt: startsAt.toISOString(), cleanerIds });
    }
    return output;
  });
  return NextResponse.json({ timezone: "Europe/Berlin", slots }, { headers: { "Cache-Control": "no-store" } });
}
