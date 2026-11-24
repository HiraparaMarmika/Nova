import { AccountType, BookingStatus, OnboardingStatus } from "@prisma/client";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { requirePortal } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { monthlySeries, statusSeries } from "@/lib/dashboard-data";

export default async function AdminPage() {
  await requirePortal(AccountType.ADMIN);
  const [queue, activeBookings, accountCount, captured, openDisputes, occurrences] = await Promise.all([
    prisma.cleaner.findMany({ where: { onboarding: OnboardingStatus.SUBMITTED }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    prisma.booking.count({ where: { status: { in: [BookingStatus.REQUESTED, BookingStatus.ACCEPTED, BookingStatus.SCHEDULED, BookingStatus.IN_PROGRESS] } } }),
    prisma.account.count(),
    prisma.payment.aggregate({ where: { status: "CAPTURED" }, _sum: { capturedCents: true } }),
    prisma.complaint.count({ where: { status: "OPEN" } }),
    prisma.occurrence.findMany({ select: { createdAt: true, status: true } })
  ]);
  return <AdminDashboard queue={queue} activeBookings={activeBookings} accountCount={accountCount} capturedCents={captured._sum.capturedCents ?? 0} openDisputes={openDisputes} activity={monthlySeries(occurrences.map(item => item.createdAt))} breakdown={statusSeries(occurrences.map(item => item.status))} />;
}
