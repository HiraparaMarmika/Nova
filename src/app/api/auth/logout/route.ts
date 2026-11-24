import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, tokenDigest } from "@/lib/demo-session";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "invalid_request" }, { status: 403 });
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    await prisma.session.deleteMany({ where: { id: tokenDigest(token) } });
  }
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
