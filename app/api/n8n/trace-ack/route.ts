// Receives the n8n tracing-pipeline workflow's final "push result to
// dashboard" HTTP Request node (SIH plan item 6). Real trace persistence
// already happened before n8n was even called (see app/api/trace/route.ts)
// — this just closes the visible loop on the n8n canvas during a demo.
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  console.log("[n8n] trace pipeline ack:", body);
  return NextResponse.json({ received: true });
}
