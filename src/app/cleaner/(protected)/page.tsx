import { AccountType, BookingStatus } from "@prisma/client";
import { CleanerDashboard } from "@/components/dashboard/cleaner-dashboard";
import { requirePortal } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { monthlySeries, statusSeries } from "@/lib/dashboard-data";

export default async function CleanerPage() {
  const session = await requirePortal(AccountType.CLEANER);
  const cleaner = await prisma.cleaner.findUniqueOrThrow({ where: { accountId: session.accountId } });
  const [requests, settled, upcomingCount, occurrences] = await Promise.all([
    prisma.occurrence.findMany({
      where: { booking: { cleanerId: cleaner.id }, status: BookingStatus.REQUESTED, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      include: { booking: true }
    }),
    prisma.occurrence.findMany({
      where: { booking: { cleanerId: cleaner.id }, status: BookingStatus.SETTLED },
      include: { financial: true }
    }),
    prisma.occurrence.count({ where: { booking: { cleanerId: cleaner.id }, status: { in: [BookingStatus.ACCEPTED, BookingStatus.SCHEDULED] }, startsAt: { gte: new Date() } } }),
    prisma.occurrence.findMany({ where: { booking: { cleanerId: cleaner.id } }, select: { createdAt: true, status: true } })
  ]);
  const next = requests[0];
  return <CleanerDashboard name={cleaner.name} onboarding={cleaner.onboarding} accountState={session.account.state} upcomingCount={upcomingCount} requestCount={requests.length} earningsCents={settled.reduce((sum, visit) => sum + (visit.financial?.cleanerNetCents ?? 0), 0)}
    next={next ? { id: next.id, startsAt: next.startsAt.toISOString(), postcode: next.booking.postcode, durationMinutes: next.booking.durationMinutes } : null} activity={monthlySeries(occurrences.map(item => item.createdAt))} breakdown={statusSeries(occurrences.map(item => item.status))} />;
}
