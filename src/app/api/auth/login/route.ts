import { AccountState, AccountType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createDemoSession, SESSION_COOKIE } from "@/lib/demo-session";
import { verifyPassword } from "@/lib/password";

const loginInput = z.object({
  portal: z.enum(["customer", "cleaner", "admin"]),
  email: z.string().email().max(320),
  password: z.string().min(1).max(256)
});

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "invalid_request" }, { status: 403 });
  const input = loginInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  const portal = input.data.portal;
  const type = portal.toUpperCase() as AccountType;
  const email = input.data.email.trim().toLowerCase();
  const account = await prisma.account.findUnique({ where: { email_type: { email, type } }, include: { cleaner: { select: { onboarding: true } }, customer: { select: { approvalStatus: true } } } });
  if (!account) {
    const accountInAnotherPortal = await prisma.account.findFirst({ where: { email }, select: { type: true } });
    if (accountInAnotherPortal) return NextResponse.json({ error: "wrong_portal", portal: accountInAnotherPortal.type.toLowerCase() }, { status: 409 });
  }
  if (!account || !await verifyPassword(input.data.password, account.passwordHash)) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  if (type === AccountType.CLEANER && account.cleaner?.onboarding !== "APPROVED") {
    const error = account.cleaner?.onboarding === "REJECTED" ? "cleaner_rejected" : "cleaner_pending";
    return NextResponse.json({ error }, { status: 403 });
  }
  if (type === AccountType.CUSTOMER && account.customer?.approvalStatus !== "APPROVED") {
    const error = account.customer?.approvalStatus === "REJECTED" ? "customer_rejected" : "customer_pending";
    return NextResponse.json({ error }, { status: 403 });
  }
  if (account.state === AccountState.SUSPENDED) return NextResponse.json({ error: "account_suspended" }, { status: 403 });
  if (account.state !== AccountState.ACTIVE) return NextResponse.json({ error: "account_unavailable" }, { status: 403 });
  const { token, expiresAt } = await createDemoSession(account.id, type);
  const response = NextResponse.json({ ok: true, portal });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
  return response;
}
