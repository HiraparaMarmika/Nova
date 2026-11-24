import { AccountType, BookingStatus } from "@prisma/client";
import { CustomerDashboard } from "@/components/dashboard/customer-dashboard";
import { requirePortal } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { monthlySeries, statusSeries } from "@/lib/dashboard-data";

export default async function CustomerPage() {
  const session = await requirePortal(AccountType.CUSTOMER);
  const customer = await prisma.customer.findUniqueOrThrow({ where: { accountId: session.accountId } });
  const [next, recurringCount, latest, occurrences] = await Promise.all([
    prisma.occurrence.findFirst({
      where: { booking: { customerId: customer.id }, status: { in: [BookingStatus.REQUESTED, BookingStatus.ACCEPTED, BookingStatus.SCHEDULED] }, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      include: { booking: { include: { cleaner: true } } }
    }),
    prisma.booking.count({ where: { customerId: customer.id, recurrenceWeeks: { not: null } } }),
    prisma.occurrence.findFirst({
      where: { booking: { customerId: customer.id }, status: BookingStatus.SETTLED },
      orderBy: { startsAt: "desc" },
      include: { financial: true }
    }),
    prisma.occurrence.findMany({ where: { booking: { customerId: customer.id } }, select: { createdAt: true, status: true } })
  ]);
  return <CustomerDashboard name={customer.name} recurringCount={recurringCount} latestInvoiceCents={latest?.financial?.grossCents ?? null}
    next={next ? { startsAt: next.startsAt.toISOString(), cleanerName: next.booking.cleaner?.name ?? "", durationMinutes: next.booking.durationMinutes } : null} activity={monthlySeries(occurrences.map(item => item.createdAt))} breakdown={statusSeries(occurrences.map(item => item.status))} />;
}
