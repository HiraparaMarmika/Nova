import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export async function POST(request:NextRequest){const raw=await request.text();const eventId=request.headers.get("stripe-event-id");if(!eventId)return NextResponse.json({error:"missing event id"},{status:400});try{await prisma.webhookEvent.create({data:{id:eventId,provider:"stripe",payload:JSON.parse(raw)}});return NextResponse.json({received:true});}catch{return NextResponse.json({received:true,duplicate:true});}}

