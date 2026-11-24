import { AccountType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";

const schema = z.object({ status: z.enum(["WAITING", "CONTACTED", "CLOSED"]), reason: z.string().trim().min(3).max(500) });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const session = await getApiSession(AccountType.ADMIN); if (!session) return NextResponse.json({ error: "admin_session_required" }, { status: 401 }); const input = schema.safeParse(await request.json().catch(() => null)); if (!input.success) return NextResponse.json({ error: "invalid_update" }, { status: 400 }); const id = (await params).id; const entry = await prisma.$transaction(async tx => { const updated = await tx.waitlistEntry.update({ where: { id }, data: { status: input.data.status } }); await tx.auditLog.create({ data: { adminId: session.accountId, action: `WAITLIST_${input.data.status}`, targetType: "WaitlistEntry", targetId: id, reason: input.data.reason, metadata: { postcode: updated.postcode, email: updated.email } } }); return updated; }); return NextResponse.json({ id: entry.id, status: entry.status }); }
