import "dotenv/config";
import { AccountState, AccountType, BookingStatus, CustomerApprovalStatus, OnboardingStatus, PaymentStatus, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

function seedPassword(option: string) {
  const value = process.argv.find(argument => argument.startsWith(`--${option}=`))?.slice(option.length + 3);
  if (!value || value.length < 12) throw new Error(`Missing --${option}=... for a new active account`);
  return value;
}

async function upsertAccount(input: { email: string; type: AccountType; state: AccountState; passwordOption?: string }) {
  const existing = await prisma.account.findUnique({ where: { email_type: { email: input.email, type: input.type } } });
  if (existing) return prisma.account.update({ where: { id: existing.id }, data: { state: input.state } });
  return prisma.account.create({
    data: {
      email: input.email,
      type: input.type,
      state: input.state,
      ...(input.passwordOption ? { passwordHash: await hashPassword(seedPassword(input.passwordOption)) } : {})
    }
  });
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed data is allowed only outside production");

  const annaAccount = await upsertAccount({ email: "anna@example.test", type: AccountType.CUSTOMER, state: AccountState.ACTIVE, passwordOption: "customer-password" });
  const leonieAccount = await upsertAccount({ email: "leonie@example.test", type: AccountType.CLEANER, state: AccountState.ACTIVE, passwordOption: "cleaner-password" });
  const marinaAccount = await upsertAccount({ email: "marina@example.test", type: AccountType.CLEANER, state: AccountState.ACTIVE, passwordOption: "cleaner-password" });
  const samiraAccount = await upsertAccount({ email: "samira@example.test", type: AccountType.CLEANER, state: AccountState.RESTRICTED });
  await upsertAccount({ email: "admin@example.test", type: AccountType.ADMIN, state: AccountState.ACTIVE, passwordOption: "admin-password" });
  await upsertAccount({ email: "admin-invite@example.test", type: AccountType.ADMIN, state: AccountState.INVITED });

  const anna = await prisma.customer.upsert({
    where: { accountId: annaAccount.id },
    update: { name: "Anna Becker", approvalStatus: CustomerApprovalStatus.APPROVED },
    create: { accountId: annaAccount.id, name: "Anna Becker", phone: "+49 30 000000", approvalStatus: CustomerApprovalStatus.APPROVED }
  });
  const leonie = await prisma.cleaner.upsert({
    where: { accountId: leonieAccount.id },
    update: { name: "Leonie König", onboarding: OnboardingStatus.APPROVED, connectPayoutsEnabled: true },
    create: { accountId: leonieAccount.id, name: "Leonie König", bio: "Synthetisches Demo-Profil in Berlin Mitte", hourlyRateCents: 3000, onboarding: OnboardingStatus.APPROVED, connectPayoutsEnabled: true }
  });
  const marina = await prisma.cleaner.upsert({
    where: { accountId: marinaAccount.id },
    update: { name: "Marina Schulz", onboarding: OnboardingStatus.APPROVED, connectPayoutsEnabled: true },
    create: { accountId: marinaAccount.id, name: "Marina Schulz", bio: "Synthetisches Demo-Profil in Berlin Prenzlauer Berg", hourlyRateCents: 3200, onboarding: OnboardingStatus.APPROVED, connectPayoutsEnabled: true }
  });
  await prisma.cleaner.upsert({
    where: { accountId: samiraAccount.id },
    update: { onboarding: OnboardingStatus.SUBMITTED, connectPayoutsEnabled: false },
    create: { accountId: samiraAccount.id, name: "Samira Özdemir", onboarding: OnboardingStatus.SUBMITTED, connectPayoutsEnabled: false }
  });
  await prisma.cleaner.update({ where: { id: leonie.id }, data: { basePostcode: "10115", serviceRadiusKm: 32 } });
  await prisma.cleaner.update({ where: { id: marina.id }, data: { basePostcode: "10117", serviceRadiusKm: 32 } });
  await prisma.postcodeLocation.upsert({ where: { postcode: "10115" }, update: { latitude: 52.532, longitude: 13.384 }, create: { postcode: "10115", latitude: 52.532, longitude: 13.384 } });
  await prisma.postcodeLocation.upsert({ where: { postcode: "10117" }, update: { latitude: 52.518, longitude: 13.386 }, create: { postcode: "10117", latitude: 52.518, longitude: 13.386 } });
  await prisma.postcodeLocation.upsert({ where: { postcode: "10119" }, update: { latitude: 52.531, longitude: 13.409 }, create: { postcode: "10119", latitude: 52.531, longitude: 13.409 } });
  for (const cleaner of [leonie, marina]) {
    await prisma.serviceArea.upsert({
      where: { cleanerId_postcodePrefix: { cleanerId: cleaner.id, postcodePrefix: "101" } },
      update: {},
      create: { cleanerId: cleaner.id, postcodePrefix: "101" }
    });
    for (const weekday of [1, 2, 3, 4, 5, 6]) await prisma.availability.upsert({
      where: { id: `demo-availability-${cleaner.id}-${weekday}` },
      update: { startsAt: "08:00", endsAt: "18:00", active: true },
      create: { id: `demo-availability-${cleaner.id}-${weekday}`, cleanerId: cleaner.id, weekday, startsAt: "08:00", endsAt: "18:00" }
    });
  }

  await prisma.consent.upsert({
    where: { id: "demo-consent-anna" },
    update: {},
    create: { id: "demo-consent-anna", customerId: anna.id, termsVersion: "demo-1.0", acceptedAt: new Date("2026-11-11T09:00:00Z"), proof: { source: "synthetic-seed", locale: "de" }, mandateReference: "local_demo_mandate_anna" }
  });
  const recurringBooking = await prisma.booking.upsert({
    where: { id: "demo-booking-recurring" },
    update: {},
    create: { id: "demo-booking-recurring", customerId: anna.id, cleanerId: leonie.id, postcode: "10115", durationMinutes: 180, extras: [], recurrenceWeeks: 2, consentId: "demo-consent-anna", status: BookingStatus.REQUESTED }
  });
  const nextVisit = await prisma.occurrence.upsert({
    where: { id: "demo-occurrence-requested" },
    update: {},
    create: { id: "demo-occurrence-requested", bookingId: recurringBooking.id, startsAt: new Date("2026-11-18T09:00:00Z"), localStart: "2026-11-18T10:00", status: BookingStatus.REQUESTED }
  });
  await prisma.lifecycleEvent.upsert({
    where: { id: "demo-event-requested" },
    update: {},
    create: { id: "demo-event-requested", occurrenceId: nextVisit.id, toStatus: BookingStatus.REQUESTED, actorId: annaAccount.id }
  });
  await prisma.payment.upsert({
    where: { occurrenceId: nextVisit.id },
    update: {},
    create: { id: "demo-payment-requested", occurrenceId: nextVisit.id, provider: "local-demo", providerReference: "local_auth_demo_requested", status: PaymentStatus.AUTHORIZED, authorizedCents: 9000, idempotencyKey: "demo-authorize-requested" }
  });
  await prisma.financialSnapshot.upsert({
    where: { occurrenceId: nextVisit.id }, update: {},
    create: { id: "demo-financial-requested", occurrenceId: nextVisit.id, durationMinutes: 180, rateCents: 3000, extrasCents: 0, grossCents: 9000, commissionBps: 3000, commissionCents: 2700, cleanerNetCents: 6300, taxTreatment: "demo-undetermined", ruleVersion: "demo-1" }
  });

  const acceptedBooking = await prisma.booking.upsert({
    where: { id: "demo-booking-accepted-november" },
    update: {},
    create: { id: "demo-booking-accepted-november", customerId: anna.id, cleanerId: marina.id, postcode: "10117", durationMinutes: 120, extras: ["windows"], status: BookingStatus.ACCEPTED }
  });
  const acceptedVisit = await prisma.occurrence.upsert({
    where: { id: "demo-occurrence-accepted-november" },
    update: {},
    create: { id: "demo-occurrence-accepted-november", bookingId: acceptedBooking.id, startsAt: new Date("2026-11-16T13:00:00Z"), localStart: "2026-11-16T14:00", status: BookingStatus.ACCEPTED }
  });
  await prisma.lifecycleEvent.upsert({ where: { id: "demo-event-accepted-requested" }, update: {}, create: { id: "demo-event-accepted-requested", occurrenceId: acceptedVisit.id, toStatus: BookingStatus.REQUESTED, actorId: annaAccount.id } });
  await prisma.lifecycleEvent.upsert({ where: { id: "demo-event-accepted" }, update: {}, create: { id: "demo-event-accepted", occurrenceId: acceptedVisit.id, fromStatus: BookingStatus.REQUESTED, toStatus: BookingStatus.ACCEPTED, actorId: marinaAccount.id } });
  await prisma.financialSnapshot.upsert({ where: { occurrenceId: acceptedVisit.id }, update: {}, create: { id: "demo-financial-accepted", occurrenceId: acceptedVisit.id, durationMinutes: 120, rateCents: 3200, extrasCents: 1200, grossCents: 7600, commissionBps: 2800, commissionCents: 2128, cleanerNetCents: 5472, taxTreatment: "demo-undetermined", ruleVersion: "demo-1" } });
  await prisma.payment.upsert({ where: { occurrenceId: acceptedVisit.id }, update: {}, create: { id: "demo-payment-accepted", occurrenceId: acceptedVisit.id, provider: "local-demo", providerReference: "local_auth_demo_accepted", status: PaymentStatus.AUTHORIZED, authorizedCents: 7600, idempotencyKey: "demo-authorize-accepted" } });

  const scheduledBooking = await prisma.booking.upsert({
    where: { id: "demo-booking-scheduled-november" },
    update: {},
    create: { id: "demo-booking-scheduled-november", customerId: anna.id, cleanerId: marina.id, postcode: "10119", durationMinutes: 180, extras: ["oven"], recurrenceWeeks: 2, status: BookingStatus.SCHEDULED }
  });
  const scheduledVisit = await prisma.occurrence.upsert({
    where: { id: "demo-occurrence-scheduled-november" },
    update: {},
    create: { id: "demo-occurrence-scheduled-november", bookingId: scheduledBooking.id, startsAt: new Date("2026-11-23T09:00:00Z"), localStart: "2026-11-23T10:00", status: BookingStatus.SCHEDULED }
  });
  await prisma.lifecycleEvent.upsert({ where: { id: "demo-event-scheduled-requested" }, update: {}, create: { id: "demo-event-scheduled-requested", occurrenceId: scheduledVisit.id, toStatus: BookingStatus.REQUESTED, actorId: annaAccount.id } });
  await prisma.lifecycleEvent.upsert({ where: { id: "demo-event-scheduled-accepted" }, update: {}, create: { id: "demo-event-scheduled-accepted", occurrenceId: scheduledVisit.id, fromStatus: BookingStatus.REQUESTED, toStatus: BookingStatus.ACCEPTED, actorId: marinaAccount.id } });
  await prisma.lifecycleEvent.upsert({ where: { id: "demo-event-scheduled" }, update: {}, create: { id: "demo-event-scheduled", occurrenceId: scheduledVisit.id, fromStatus: BookingStatus.ACCEPTED, toStatus: BookingStatus.SCHEDULED, actorId: marinaAccount.id } });
  await prisma.financialSnapshot.upsert({ where: { occurrenceId: scheduledVisit.id }, update: {}, create: { id: "demo-financial-scheduled", occurrenceId: scheduledVisit.id, durationMinutes: 180, rateCents: 3200, extrasCents: 1200, grossCents: 10800, commissionBps: 3000, commissionCents: 3240, cleanerNetCents: 7560, taxTreatment: "demo-undetermined", ruleVersion: "demo-1" } });
  await prisma.payment.upsert({ where: { occurrenceId: scheduledVisit.id }, update: {}, create: { id: "demo-payment-scheduled", occurrenceId: scheduledVisit.id, provider: "local-demo", providerReference: "local_auth_demo_scheduled", status: PaymentStatus.AUTHORIZED, authorizedCents: 10800, idempotencyKey: "demo-authorize-scheduled" } });

  const pastBooking = await prisma.booking.upsert({
    where: { id: "demo-booking-onetime" },
    update: {},
    create: { id: "demo-booking-onetime", customerId: anna.id, cleanerId: leonie.id, postcode: "10115", durationMinutes: 180, extras: [], status: BookingStatus.SETTLED }
  });
  const pastVisit = await prisma.occurrence.upsert({
    where: { id: "demo-occurrence-settled" },
    update: {},
    create: { id: "demo-occurrence-settled", bookingId: pastBooking.id, startsAt: new Date("2026-11-04T09:00:00Z"), localStart: "2026-11-04T10:00", status: BookingStatus.SETTLED }
  });
  await prisma.financialSnapshot.upsert({
    where: { occurrenceId: pastVisit.id },
    update: {},
    create: { id: "demo-financial-settled", occurrenceId: pastVisit.id, durationMinutes: 180, rateCents: 2800, extrasCents: 0, grossCents: 8400, commissionBps: 2800, commissionCents: 2352, cleanerNetCents: 6048, taxTreatment: "demo-undetermined", ruleVersion: "demo-1" }
  });
  await prisma.payment.upsert({
    where: { occurrenceId: pastVisit.id },
    update: {},
    create: { id: "demo-payment-settled", occurrenceId: pastVisit.id, provider: "local-demo", providerReference: "local_capture_demo_settled", status: PaymentStatus.CAPTURED, authorizedCents: 8400, capturedCents: 8400, idempotencyKey: "demo-capture-settled" }
  });
  await prisma.review.upsert({
    where: { occurrenceId: pastVisit.id },
    update: {},
    create: { id: "demo-review-settled", occurrenceId: pastVisit.id, rating: 5, body: "Synthetische Demo-Bewertung" }
  });
  await prisma.invoice.upsert({ where: { occurrenceId: pastVisit.id }, update: {}, create: { id: "demo-invoice-settled", occurrenceId: pastVisit.id, number: "NOVA-2026-DEMO0001", amountCents: 8400 } });
  await prisma.payout.upsert({ where: { occurrenceId: pastVisit.id }, update: {}, create: { id: "demo-payout-settled", occurrenceId: pastVisit.id, cleanerId: leonie.id, amountCents: 6048, status: "DEMO_PAID", paidAt: new Date("2026-11-06T12:00:00Z") } });
  await prisma.complaint.upsert({ where: { occurrenceId: pastVisit.id }, update: {}, create: { id: "demo-complaint-settled", occurrenceId: pastVisit.id, reason: "Synthetic resolved support case for the operations demo.", status: "RESOLVED", resolvedAt: new Date("2026-11-05T12:00:00Z"), resolution: "NO_ACTION: Service outcome confirmed with the customer." } });
  await prisma.relationship.upsert({
    where: { customerId_cleanerId: { customerId: anna.id, cleanerId: leonie.id } },
    update: {},
    create: { customerId: anna.id, cleanerId: leonie.id, recurringCompletedCount: 0 }
  });
  await prisma.appConfig.upsert({
    where: { key_version: { key: "commission", version: 1 } },
    update: {},
    create: { key: "commission", version: 1, value: { oneTimeBps: 2800, recurringFirstTwoBps: 3000, recurringThereafterBps: 2000, rounding: "half-up cents" } }
  });
  await prisma.appConfig.upsert({ where: { key_version: { key: "operations", version: 1 } }, update: {}, create: { key: "operations", version: 1, value: { requestExpiryHours: 24, complaintWindowHours: 48, cancellationNoticeHours: 24, lateCancellationFeeBps: 2500, recurringHorizonCount: 8 } } });
  await prisma.waitlistEntry.upsert({ where: { email_postcode: { email: "waitlist@example.test", postcode: "80331" } }, update: {}, create: { email: "waitlist@example.test", postcode: "80331" } });
  const notificationRows = [
    { id: "demo-notification-customer", accountId: annaAccount.id, kind: "REMINDER", subject: "Upcoming NOVA visit", body: "Your next demo visit is ready in the appointments panel." },
    { id: "demo-notification-cleaner", accountId: leonieAccount.id, kind: "BOOKING_REQUEST", subject: "New booking request", body: "A customer requested a recurring cleaning visit." },
  ];
  for (const item of notificationRows) await prisma.notification.upsert({ where: { id: item.id }, update: {}, create: item });
  await prisma.job.upsert({ where: { dedupeKey: "demo-expire-requested" }, update: {}, create: { id: "demo-job-expire", kind: "EXPIRE_REQUEST", dedupeKey: "demo-expire-requested", payload: { occurrenceId: nextVisit.id }, runAt: new Date("2026-11-17T09:00:00Z") } });
  await prisma.job.upsert({ where: { dedupeKey: "demo-reminder-scheduled" }, update: {}, create: { id: "demo-job-reminder", kind: "REMINDER_VISIT", dedupeKey: "demo-reminder-scheduled", payload: { occurrenceId: scheduledVisit.id }, runAt: new Date("2026-11-22T09:00:00Z") } });
  console.log("Synthetic NOVA demo data seeded.");
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
