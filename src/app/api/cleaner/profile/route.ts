import { AccountType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";

const schema = z.object({ name: z.string().trim().min(2).max(100), bio: z.string().trim().min(20).max(1000), hourlyRateCents: z.number().int().min(1500).max(10000), legalStatus: z.string().trim().min(2).max(80), taxReference: z.string().trim().max(100).optional(), basePostcode: z.string().regex(/^\d{5}$/), serviceRadiusKm: z.number().int().min(1).max(160), areas: z.array(z.string().regex(/^\d{3}$/)).max(20) });
export async function PATCH(request: NextRequest) {
  const session = await getApiSession(AccountType.CLEANER);
  if (!session) return NextResponse.json({ error: "cleaner_session_required" }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_profile" }, { status: 400 });
  await prisma.$transaction(async tx => {
    const cleaner = await tx.cleaner.update({ where: { accountId: session.accountId }, data: { name: input.data.name, bio: input.data.bio, hourlyRateCents: input.data.hourlyRateCents, legalStatus: input.data.legalStatus, taxReference: input.data.taxReference || null, basePostcode: input.data.basePostcode, serviceRadiusKm: input.data.serviceRadiusKm } });
    await tx.serviceArea.deleteMany({ where: { cleanerId: cleaner.id } });
    await tx.serviceArea.createMany({ data: [...new Set(input.data.areas)].map(postcodePrefix => ({ cleanerId: cleaner.id, postcodePrefix })) });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return NextResponse.json({ ok: true });
}
