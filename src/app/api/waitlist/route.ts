import { AccountState, OnboardingStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { coversPostcode } from "@/domain/coverage";

const schema = z.object({ email: z.string().email().max(320), postcode: z.string().regex(/^\d{5}$/) });
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_waitlist_entry" }, { status: 400 });
  const available = await prisma.$transaction(async tx => {
    const cleaners = await tx.cleaner.findMany({
      where: { account: { state: AccountState.ACTIVE }, onboarding: OnboardingStatus.APPROVED, connectPayoutsEnabled: true },
      select: { basePostcode: true, serviceRadiusKm: true, areas: { select: { postcodePrefix: true } } }
    });
    const postcodes = [...new Set([input.data.postcode, ...cleaners.flatMap(cleaner => cleaner.basePostcode ? [cleaner.basePostcode] : [])])];
    const locations = await tx.postcodeLocation.findMany({ where: { postcode: { in: postcodes } } });
    const locationByPostcode = new Map(locations.map(location => [location.postcode, location]));
    return cleaners.some(cleaner => coversPostcode({
      bookingPostcode: input.data.postcode,
      explicitPrefixes: cleaner.areas.map(area => area.postcodePrefix),
      basePostcode: cleaner.basePostcode,
      radiusKm: cleaner.serviceRadiusKm,
      bookingLocation: locationByPostcode.get(input.data.postcode),
      baseLocation: cleaner.basePostcode ? locationByPostcode.get(cleaner.basePostcode) : undefined
    }));
  });
  if (available) return NextResponse.json({ available: true });
  const entry = await prisma.waitlistEntry.upsert({ where: { email_postcode: { email: input.data.email.toLowerCase(), postcode: input.data.postcode } }, update: { status: "WAITING" }, create: { email: input.data.email.toLowerCase(), postcode: input.data.postcode } });
  return NextResponse.json({ id: entry.id, available: false }, { status: 201 });
}
