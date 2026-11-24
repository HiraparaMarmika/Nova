import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const portals = {
  CUSTOMER: ["/customer", "/customer/appointments", "/customer/recurring", "/customer/invoices", "/customer/notifications", "/customer/profile"],
  CLEANER: ["/cleaner", "/cleaner/requests", "/cleaner/calendar", "/cleaner/earnings", "/cleaner/reviews", "/cleaner/notifications", "/cleaner/profile"],
  ADMIN: ["/admin", "/admin/users", "/admin/review-queue", "/admin/customers", "/admin/cleaners", "/admin/bookings", "/admin/payments", "/admin/disputes", "/admin/reconciliation", "/admin/risk", "/admin/waitlist", "/admin/notifications", "/admin/configuration", "/admin/audit-log"],
};
const created = [];
try {
  for (const [scope, routes] of Object.entries(portals)) {
    const account = await prisma.account.findFirstOrThrow({ where: { type: scope, state: "ACTIVE" } });
    const token = randomBytes(32).toString("base64url"); const id = createHash("sha256").update(token).digest("hex"); created.push(id);
    await prisma.session.create({ data: { id, accountId: account.id, scope, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    for (const route of routes) { const response = await fetch(new URL(route, base), { headers: { cookie: `nova_demo_session=${token}` }, redirect: "manual" }); assert.equal(response.status, 200, `${scope} ${route}`); }
    console.log(`${scope}: ${routes.length} portal routes passed`);
  }
  const activation = await fetch(new URL("/admin/activate?token=invalid", base)); assert.equal(activation.status, 200);
  console.log("Public admin activation route passed");
} finally {
  if (created.length) await prisma.session.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
}
