import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ connected: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Database health check failed", error);
    return NextResponse.json({ connected: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
