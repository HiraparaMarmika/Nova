import { AccountType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";

const schema = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().max(40).optional() });
export async function PATCH(request: NextRequest) {
  const session = await getApiSession(AccountType.CUSTOMER);
  if (!session) return NextResponse.json({ error: "customer_session_required" }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_profile" }, { status: 400 });
  const customer = await prisma.customer.update({ where: { accountId: session.accountId }, data: { name: input.data.name, phone: input.data.phone || null } });
  return NextResponse.json({ id: customer.id });
}
