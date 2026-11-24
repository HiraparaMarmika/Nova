import { randomUUID } from "node:crypto";
import { AccountState, AccountType, OnboardingStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { queueAccountEmail, queueAdminEmails } from "@/lib/email";
import { appUrl } from "@/domain/operations";
import { isValidAvailability } from "@/domain/scheduling";

const availabilitySchema = z.object({ weekday: z.number().int().min(0).max(6), startsAt: z.string(), endsAt: z.string() });
const inputSchema = z.object({ email: z.string().email().max(320), password: z.string().min(12).max(256), name: z.string().trim().min(2).max(100), bio: z.string().trim().min(20).max(1000), hourlyRateCents: z.number().int().min(1500).max(10000), basePostcode: z.string().regex(/^\d{5}$/), serviceRadiusKm: z.number().int().min(1).max(160), postcodePrefix: z.string().regex(/^\d{3}$/).optional(), availability: z.array(availabilitySchema).min(1).max(14), legalStatus: z.string().trim().min(2).max(80), taxReference: z.string().trim().max(100).optional(), taxDeclaration: z.boolean() });
export async function POST(request: NextRequest) {
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || !input.data.taxDeclaration || !isValidAvailability(input.data.availability)) return NextResponse.json({ error: "invalid_application" }, { status: 400 });
  const email = input.data.email.toLowerCase();
  if (await prisma.account.findUnique({ where: { email_type: { email, type: AccountType.CLEANER } } })) return NextResponse.json({ error: "account_exists" }, { status: 409 });
  const result = await prisma.$transaction(async tx => {
    const account = await tx.account.create({ data: { email, type: AccountType.CLEANER, state: AccountState.ACTIVE, passwordHash: await hashPassword(input.data.password) } });
    const cleaner = await tx.cleaner.create({ data: { accountId: account.id, name: input.data.name, bio: input.data.bio, legalStatus: input.data.legalStatus, taxReference: input.data.taxReference || null, hourlyRateCents: input.data.hourlyRateCents, basePostcode: input.data.basePostcode, serviceRadiusKm: input.data.serviceRadiusKm, onboarding: OnboardingStatus.SUBMITTED, connectPayoutsEnabled: false } });
    if (input.data.postcodePrefix) await tx.serviceArea.create({ data: { cleanerId: cleaner.id, postcodePrefix: input.data.postcodePrefix } });
    await tx.availability.createMany({ data: input.data.availability.map(item => ({ cleanerId: cleaner.id, ...item })) });
    await tx.document.create({ data: { cleanerId: cleaner.id, kind: "APPLICATION_DECLARATION", storageKey: `applications/${cleaner.id}/${randomUUID()}` } });
    await tx.notification.create({ data: { accountId: account.id, kind: "APPLICATION", subject: "Application submitted", body: "Your application is waiting for administrator review. Upload identity, tax and insurance documents from Profile & documents." } });
    await queueAccountEmail(tx, { accountId: account.id, eventKey: "cleaner-application:" + cleaner.id + ":applicant", subject: "We received your NOVA cleaner application", title: "Your application is under review", greeting: cleaner.name, message: "Thanks for applying to clean with NOVA. Our team will review your application and let you know when there is an update.", action: { label: "View your profile", url: appUrl("/cleaner/profile") } });
    await queueAdminEmails(tx, { eventKey: "cleaner-application:" + cleaner.id, subject: "New NOVA cleaner application", title: "A cleaner application needs review", message: cleaner.name + " submitted a cleaner application.", details: ["Applicant: " + cleaner.name, "Area: " + input.data.basePostcode], action: { label: "Review application", url: appUrl("/admin/review-queue") } });
    const admins = await tx.account.findMany({ where: { type: AccountType.ADMIN, state: AccountState.ACTIVE }, select: { id: true } });
    if (admins.length) await tx.notification.createMany({ data: admins.map(admin => ({ accountId: admin.id, kind: "CLEANER_APPLICATION", subject: "Cleaner application submitted", body: `${input.data.name} submitted a cleaner application.` })) });
    return cleaner;
  });
  return NextResponse.json({ id: result.id, onboarding: result.onboarding }, { status: 201 });
}
