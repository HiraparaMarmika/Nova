import { AccountType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";
import { notify } from "@/domain/operations";

const messageInput = z.object({ body: z.string().trim().min(1).max(1000) });

async function bookingForParticipant(id: string, accountId: string, scope: AccountType) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: { include: { account: { select: { id: true, displayName: true } } } },
      cleaner: { include: { account: { select: { id: true, displayName: true } } } },
      messages: {
        include: {
          sender: {
            select: {
              id: true,
              displayName: true,
              customer: { select: { name: true } },
              cleaner: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  });
  if (!booking) return null;
  const participant = booking.customer.accountId === accountId || booking.cleaner?.accountId === accountId;
  return participant || scope === AccountType.ADMIN ? booking : null;
}

function senderName(message: { sender: { displayName: string | null; customer: { name: string } | null; cleaner: { name: string } | null } }) {
  return message.sender.customer?.name ?? message.sender.cleaner?.name ?? message.sender.displayName ?? "NOVA user";
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const booking = await bookingForParticipant((await params).id, session.accountId, session.scope);
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.scope !== AccountType.ADMIN) await prisma.bookingMessage.updateMany({ where: { bookingId: booking.id, senderAccountId: { not: session.accountId }, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ messages: booking.messages.map(message => ({ id: message.id, body: message.body, createdAt: message.createdAt, senderAccountId: message.senderAccountId, senderName: senderName(message) })) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session || (session.scope !== AccountType.CUSTOMER && session.scope !== AccountType.CLEANER)) return NextResponse.json({ error: "participant_session_required" }, { status: 401 });
  const input = messageInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  const booking = await bookingForParticipant((await params).id, session.accountId, session.scope);
  if (!booking || !booking.cleaner) return NextResponse.json({ error: "booking_not_available" }, { status: 404 });
  const recipientId = booking.customer.accountId === session.accountId ? booking.cleaner.accountId : booking.customer.accountId;
  const message = await prisma.$transaction(async tx => {
    const created = await tx.bookingMessage.create({ data: { bookingId: booking.id, senderAccountId: session.accountId, body: input.data.body } });
    await notify(tx, recipientId, "BOOKING_MESSAGE", "New booking message", "You have a new message about an assigned NOVA booking.");
    return created;
  });
  return NextResponse.json({ id: message.id, createdAt: message.createdAt }, { status: 201 });
}
