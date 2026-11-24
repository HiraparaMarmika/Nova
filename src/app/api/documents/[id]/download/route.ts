import { readFile } from "node:fs/promises";
import path from "node:path";
import { AccountType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(); if (!session) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const document = await prisma.document.findUnique({ where: { id: (await params).id }, include: { cleaner: true } });
  if (!document || (session.scope !== AccountType.ADMIN && document.cleaner.accountId !== session.accountId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const root = path.resolve(process.cwd(), "storage"); const target = path.resolve(root, document.storageKey);
  if (!target.startsWith(`${root}${path.sep}`)) return NextResponse.json({ error: "invalid_storage_key" }, { status: 400 });
  try { const data = await readFile(target); return new NextResponse(data, { headers: { "Content-Type": document.mimeType ?? "application/octet-stream", "Content-Disposition": `attachment; filename="${(document.originalName ?? "document").replaceAll('"', "")}"`, "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "file_not_found" }, { status: 404 }); }
}
