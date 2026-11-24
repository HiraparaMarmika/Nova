import { AccountType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";

function escape(value: string) { return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]!)); }
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(); if (!session) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const invoice = await prisma.invoice.findUnique({ where: { id: (await params).id }, include: { occurrence: { include: { booking: { include: { customer: true, cleaner: true } }, financial: true } } } });
  if (!invoice) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const owns = session.scope === AccountType.ADMIN || invoice.occurrence.booking.customer.accountId === session.accountId;
  if (!owns) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(invoice.number)}</title><style>body{font-family:Arial,sans-serif;color:#102a43;max-width:760px;margin:50px auto;padding:24px}header{display:flex;justify-content:space-between;border-bottom:2px solid #0f766e;padding-bottom:20px}table{width:100%;border-collapse:collapse;margin-top:30px}td,th{text-align:left;padding:12px;border-bottom:1px solid #dde5ec}.total{font-size:22px;font-weight:700;text-align:right;margin-top:25px;color:#0f766e}</style></head><body><header><div><h1>NOVA</h1><p>Demo service invoice</p></div><div><strong>${escape(invoice.number)}</strong><p>${invoice.issuedAt.toLocaleDateString("en-GB")}</p></div></header><p><strong>Customer:</strong> ${escape(invoice.occurrence.booking.customer.name)}</p><p><strong>Cleaner:</strong> ${escape(invoice.occurrence.booking.cleaner?.name ?? "Unassigned")}</p><table><tr><th>Service date</th><th>Duration</th><th>Status</th></tr><tr><td>${invoice.occurrence.startsAt.toLocaleString("en-GB")}</td><td>${invoice.occurrence.booking.durationMinutes / 60} hours</td><td>${escape(invoice.status)}</td></tr></table><p class="total">Total €${(invoice.amountCents / 100).toFixed(2)}</p><p>This is a local demo invoice. It is not a German tax invoice.</p></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `inline; filename="${invoice.number}.html"`, "Cache-Control": "private, no-store" } });
}
