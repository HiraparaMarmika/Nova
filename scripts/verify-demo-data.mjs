import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const [accounts, customers, cleaners, bookings, occurrences, payments] = await Promise.all([
    prisma.account.count(), prisma.customer.count(), prisma.cleaner.count(),
    prisma.booking.count(), prisma.occurrence.count(), prisma.payment.count()
  ]);
  assert.deepEqual({ accounts, customers, cleaners, bookings, occurrences, payments },
    { accounts: 6, customers: 1, cleaners: 3, bookings: 4, occurrences: 4, payments: 4 });
  const admin = await prisma.account.findUnique({ where: { email_type: { email: "admin@example.test", type: "ADMIN" } } });
  assert.equal(admin?.state, "ACTIVE");
  assert.equal(admin?.mfaEnabled, false);
  assert.ok(admin?.passwordHash?.startsWith("scrypt:"));
  console.log(JSON.stringify({ accounts, customers, cleaners, bookings, occurrences, payments }));
  console.log("Demo data and admin password sign-in verified.");
} finally {
  await prisma.$disconnect();
}
