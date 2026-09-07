// Receives the n8n Sahyog-mock workflow's "route to Sahyog" HTTP Request
// node (SIH plan item 9). Nothing real is being routed — this endpoint is
// itself part of the simulation, confirming the mock request made a full
// round trip across n8n's canvas without leaving the local system.
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  console.log("[n8n] Sahyog mock ack:", body);
  return NextResponse.json({ received: true });
}
