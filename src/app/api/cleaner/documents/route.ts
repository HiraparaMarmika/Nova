import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AccountType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/demo-session";
import { prisma } from "@/lib/db";

const allowed = new Map([["application/pdf", ".pdf"], ["image/jpeg", ".jpg"], ["image/png", ".png"]]);
export async function POST(request: NextRequest) {
  const session = await getApiSession(AccountType.CLEANER);
  if (!session) return NextResponse.json({ error: "cleaner_session_required" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file"); const kind = String(form.get("kind") ?? "").trim().toUpperCase();
  if (!(file instanceof File) || !["IDENTITY", "TAX", "INSURANCE", "PHOTO"].includes(kind) || !allowed.has(file.type) || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "invalid_document" }, { status: 400 });
  const cleaner = await prisma.cleaner.findUniqueOrThrow({ where: { accountId: session.accountId } });
  const fileName = `${randomUUID()}${allowed.get(file.type)}`;
  const relativeKey = path.join("cleaner-documents", cleaner.id, fileName).replaceAll("\\", "/");
  const directory = path.resolve(process.cwd(), "storage", "cleaner-documents", cleaner.id);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), Buffer.from(await file.arrayBuffer()));
  const document = await prisma.document.create({ data: { cleanerId: cleaner.id, kind, storageKey: relativeKey, originalName: file.name.slice(0, 255), mimeType: file.type, sizeBytes: file.size, status: "PENDING" } });
  return NextResponse.json({ id: document.id }, { status: 201 });
}
