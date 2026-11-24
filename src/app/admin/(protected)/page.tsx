import { AccountState, AccountType, BookingStatus, CustomerApprovalStatus, OnboardingStatus, PaymentStatus } from "@prisma/client";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { requirePortal } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { monthlySeries, statusSeries } from "@/lib/dashboard-data";

export default async function AdminPage() {
  await requirePortal(AccountType.ADMIN);
  const now = new Date();
  const liveStatuses = [BookingStatus.REQUESTED, BookingStatus.ACCEPTED, BookingStatus.SCHEDULED, BookingStatus.IN_PROGRESS];
  const [queue, customerQueue, activeBookings, accountCount, captured, openDisputes, occurrences, approvedCleaners, approvedCustomers, failedPayments, generatedInvoices, availabilityCleaners, recentBookings, audits, admins] = await Promise.all([
    prisma.cleaner.findMany({ where: { onboarding: { in: [OnboardingStatus.SUBMITTED, OnboardingStatus.UNDER_REVIEW, OnboardingStatus.NEEDS_CHANGES] } }, select: { id: true, name: true, createdAt: true, account: { select: { email: true } }, areas: { select: { postcodePrefix: true } }, _count: { select: { documents: true } } }, orderBy: { createdAt: "asc" }, take: 8 }),
    prisma.customer.findMany({ where: { approvalStatus: { in: [CustomerApprovalStatus.PENDING, CustomerApprovalStatus.NEEDS_CHANGES] } }, select: { id: true, name: true, createdAt: true, approvalStatus: true, account: { select: { email: true } } }, orderBy: { createdAt: "asc" }, take: 8 }),
    prisma.booking.count({ where: { status: { in: liveStatuses } } }),
    prisma.account.count(),
    prisma.payment.aggregate({ where: { status: PaymentStatus.CAPTURED }, _sum: { capturedCents: true } }),
    prisma.complaint.count({ where: { status: "OPEN" } }),
    prisma.occurrence.findMany({ select: { createdAt: true, status: true } }),
    prisma.cleaner.count({ where: { onboarding: OnboardingStatus.APPROVED, account: { state: AccountState.ACTIVE } } }),
    prisma.customer.count({ where: { approvalStatus: CustomerApprovalStatus.APPROVED, account: { state: AccountState.ACTIVE } } }),
    prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
    prisma.invoice.count(),
    prisma.cleaner.findMany({ where: { onboarding: OnboardingStatus.APPROVED, account: { state: AccountState.ACTIVE } }, select: { id: true, name: true, basePostcode: true, availability: { where: { active: true }, select: { weekday: true, startsAt: true, endsAt: true }, orderBy: [{ weekday: "asc" }, { startsAt: "asc" }] }, availabilityBlocks: { where: { date: { gte: now } }, select: { id: true } }, bookings: { select: { occurrences: { where: { startsAt: { gte: now }, status: { in: liveStatuses } }, select: { id: true } } } } }, take: 6 }),
    prisma.occurrence.findMany({ include: { booking: { include: { customer: true, cleaner: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.account.findMany({ where: { type: AccountType.ADMIN }, select: { id: true, email: true, displayName: true } }),
  ]);
  const adminById = new Map(admins.map(admin => [admin.id, admin.displayName || admin.email]));
  return <AdminDashboard queue={queue.map(item => ({ id: item.id, name: item.name, email: item.account.email, createdAt: item.createdAt.toISOString(), documents: item._count.documents, areas: item.areas.map(area => area.postcodePrefix) }))} customerQueue={customerQueue.map(item => ({ id: item.id, name: item.name, email: item.account.email, createdAt: item.createdAt.toISOString(), status: item.approvalStatus }))} activeBookings={activeBookings} accountCount={accountCount} capturedCents={captured._sum.capturedCents ?? 0} openDisputes={openDisputes} approvedCleaners={approvedCleaners} approvedCustomers={approvedCustomers} failedPayments={failedPayments} generatedInvoices={generatedInvoices} activity={monthlySeries(occurrences.map(item => item.createdAt))} breakdown={statusSeries(occurrences.map(item => item.status))} availability={availabilityCleaners.map(item => ({ id: item.id, name: item.name, location: item.basePostcode, schedule: item.availability.length ? item.availability.map(range => `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][range.weekday]} ${range.startsAt}–${range.endsAt}`).join(", ") : "No active schedule", upcomingBookings: item.bookings.reduce((total, booking) => total + booking.occurrences.length, 0), blockedDates: item.availabilityBlocks.length }))} recentBookings={recentBookings.map(item => ({ id: item.id, customer: item.booking.customer.name, cleaner: item.booking.cleaner?.name ?? "Unassigned", startsAt: item.startsAt.toISOString(), status: item.status }))} recentActivity={audits.map(item => ({ id: item.id, action: item.action, admin: adminById.get(item.adminId) ?? "System or removed admin", target: `${item.targetType} · ${item.targetId}`, createdAt: item.createdAt.toISOString() }))} />;
}
