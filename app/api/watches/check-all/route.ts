// Token-gated bulk check for an external scheduler (cron, n8n) — there's no
// in-app worker (ROADMAP item 6's explicit architecture-cost call). Excluded
// from proxy.ts's session gate the same way the n8n ack routes are: this is
// called server-to-server, with a bearer token instead of a browser session.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { checkWatch } from "@/lib/watch";

function tokenMatches(req: Request): boolean {
  const expected = process.env.WATCH_CRON_TOKEN;
  if (!expected) return false; // unset = feature disabled, not "any token works"
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!tokenMatches(req)) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const watches = await prisma.watch.findMany();
  const results: { watchId: string; newAlerts?: number; error?: string }[] = [];
  for (const watch of watches) {
    try {
      const newAlerts = await checkWatch(watch);
      results.push({ watchId: watch.id, newAlerts });
    } catch (err) {
      results.push({ watchId: watch.id, error: (err as Error).message });
    }
  }
  await audit(null, "WATCH_CHECK", null, { bulk: true, count: watches.length });
  return NextResponse.json({ results });
}
