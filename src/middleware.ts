import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return NextResponse.next();
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
