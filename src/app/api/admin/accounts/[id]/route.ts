import { AccountState, AccountType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";

const stateSchema = z.object({ operation: z.literal("state"), state: z.nativeEnum(AccountState), reason: z.string().trim().min(3).max(500) });
const updateSchema = z.object({ operation: z.literal("update"), email: z.string().email().max(320), name: z.string().trim().min(2).max(100).optional(), phone: z.string().trim().max(40).optional(), state: z.nativeEnum(AccountState), reason: z.string().trim().min(3).max(500) });
const deactivateSchema = z.object({ operation: z.literal("deactivate"), reason: z.string().trim().min(3).max(500) });
const inputSchema = z.discriminatedUnion("operation", [stateSchema, updateSchema, deactivateSchema]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(AccountType.ADMIN); if (!session) return NextResponse.json({ error: "admin_session_required" }, { status: 401 });
  const input = inputSchema.safeParse(await request.json().catch(() => null)); if (!input.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const id = (await params).id; const requestedState = input.data.operation === "deactivate" ? AccountState.SUSPENDED : input.data.state;
  if (id === session.accountId && requestedState !== AccountState.ACTIVE) return NextResponse.json({ error: "cannot_lock_self" }, { status: 409 });
  try {
    const account = await prisma.$transaction(async tx => {
      const current = await tx.account.findUnique({ where: { id }, include: { customer: true, cleaner: true } }); if (!current) throw new Error("not_found");
      if (current.type === AccountType.ADMIN && current.state === AccountState.ACTIVE && requestedState !== AccountState.ACTIVE) { const activeAdmins = await tx.account.count({ where: { type: AccountType.ADMIN, state: AccountState.ACTIVE } }); if (activeAdmins <= 1) throw new Error("last_active_admin"); }
      const data: { state: AccountState; email?: string; displayName?: string | null; phone?: string | null } = { state: requestedState };
      if (input.data.operation === "update") { data.email = input.data.email.toLowerCase(); if (!current.customer) data.phone = input.data.phone || null; if (current.type === AccountType.ADMIN) data.displayName = input.data.name || null; }
      const updated = await tx.account.update({ where: { id }, data });
      if (input.data.operation === "update") { if (current.customer && input.data.name) await tx.customer.update({ where: { accountId: id }, data: { name: input.data.name, phone: input.data.phone || null } }); if (current.cleaner && input.data.name) await tx.cleaner.update({ where: { accountId: id }, data: { name: input.data.name } }); }
      if (requestedState !== AccountState.ACTIVE) await tx.session.deleteMany({ where: { accountId: id } });
      await tx.auditLog.create({ data: { adminId: session.accountId, action: input.data.operation === "deactivate" ? "ACCOUNT_DEACTIVATED" : input.data.operation === "update" ? "ACCOUNT_UPDATED" : `ACCOUNT_${requestedState}`, targetType: "Account", targetId: id, reason: input.data.reason, metadata: { role: updated.type, email: updated.email } } }); return updated;
    });
    return NextResponse.json({ id: account.id, state: account.state, email: account.email });
  } catch (error) { if (error instanceof Error && error.message === "not_found") return NextResponse.json({ error: "account_not_found" }, { status: 404 }); if (error instanceof Error && error.message === "last_active_admin") return NextResponse.json({ error: "last_active_admin" }, { status: 409 }); return NextResponse.json({ error: "account_update_failed" }, { status: 409 }); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null); const rewritten = new NextRequest(request, { method: "PATCH", body: JSON.stringify({ operation: "deactivate", reason: body?.reason }) }); return PATCH(rewritten, context);
}
