import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountType, AccountState } from "@prisma/client";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "nova_demo_session";
const SESSION_HOURS = 8;

export function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createDemoSession(accountId: string, scope: AccountType) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await prisma.session.create({ data: { id: tokenDigest(token), accountId, scope, expiresAt } });
  return { token, expiresAt };
}

async function readSession(allowInactive = false) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await prisma.session.findUnique({ where: { id: tokenDigest(token) }, include: { account: { include: { cleaner: { select: { onboarding: true } } } } } });
  if (!session || session.expiresAt <= new Date() || (!allowInactive && session.account.state !== AccountState.ACTIVE) || session.scope !== session.account.type || (session.scope === AccountType.CLEANER && session.account.cleaner?.onboarding !== "APPROVED")) return null;
  return session;
}

export async function getDemoSession() { return readSession(false); }

export async function getApiSession(scope?: AccountType) {
  const session = await getDemoSession();
  if (!session || (scope && session.scope !== scope)) return null;
  return session;
}

export async function requirePortal(scope: AccountType) {
  const session = await readSession(scope === AccountType.CLEANER);
  if (!session || session.scope !== scope) redirect(`/${scope.toLowerCase()}/sign-in`);
  return session;
}
