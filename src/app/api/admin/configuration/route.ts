import { AccountType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";

const schema = z.object({ requestExpiryHours: z.number().int().min(1).max(168), complaintWindowHours: z.number().int().min(1).max(720), cancellationNoticeHours: z.number().int().min(0).max(168), lateCancellationFeeBps: z.number().int().min(0).max(10000), recurringHorizonCount: z.number().int().min(2).max(24), reason: z.string().trim().min(3).max(500) });
export async function PATCH(request: NextRequest) {
  const session = await getApiSession(AccountType.ADMIN); if (!session) return NextResponse.json({ error: "admin_session_required" }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null)); if (!input.success) return NextResponse.json({ error: "invalid_configuration" }, { status: 400 });
  const { reason, ...value } = input.data;
  const config = await prisma.$transaction(async tx => { const latest = await tx.appConfig.findFirst({ where: { key: "operations" }, orderBy: { version: "desc" } }); const next = await tx.appConfig.create({ data: { key: "operations", version: (latest?.version ?? 0) + 1, value: value as Prisma.InputJsonValue } }); await tx.auditLog.create({ data: { adminId: session.accountId, action: "CONFIGURATION_PUBLISHED", targetType: "AppConfig", targetId: next.id, reason, metadata: { version: next.version } } }); return next; });
  return NextResponse.json({ id: config.id, version: config.version });
}
