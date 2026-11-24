import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo-session";

export async function GET() {
  const session = await getDemoSession();
  return NextResponse.json(session ? { authenticated: true, scope: session.scope.toLowerCase() } : { authenticated: false }, { headers: { "Cache-Control": "no-store" } });
}
