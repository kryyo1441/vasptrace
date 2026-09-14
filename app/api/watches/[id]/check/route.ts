// Manual "check now" for one watch — session-gated, the same auth a browser
// click already carries. app/api/watches/check-all/route.ts is the separate,
// token-gated route for an external scheduler.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { checkWatch } from "@/lib/watch";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const watch = await prisma.watch.findUnique({ where: { id } });
  if (!watch || (watch.createdById !== user.id && user.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Watch not found" }, { status: 404 });
  }

  try {
    const newAlerts = await checkWatch(watch);
    await audit(user.id, "WATCH_CHECK", null, { watchId: watch.id, newAlerts });
    return NextResponse.json({ newAlerts });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
