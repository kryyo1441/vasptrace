import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ADDRESS_VALIDATORS } from "@/lib/address";
import type { Chain } from "@/lib/generated/prisma/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const watches = await prisma.watch.findMany({
    where: user.role === "SUPERVISOR" ? {} : { createdById: user.id },
    include: { alerts: { orderBy: { createdAt: "desc" }, take: 10 } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(watches);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { address: raw, chain } = (body ?? {}) as { address?: string; chain?: string };
  if (!raw || typeof raw !== "string") return NextResponse.json({ error: "address is required" }, { status: 400 });
  const address = raw.trim();
  if (!chain || !(chain in ADDRESS_VALIDATORS)) {
    return NextResponse.json({ error: "chain is required" }, { status: 400 });
  }
  const typedChain = chain as Chain;
  if (!ADDRESS_VALIDATORS[typedChain].test(address)) {
    return NextResponse.json({ error: `address is not a valid ${typedChain} address` }, { status: 400 });
  }

  try {
    const watch = await prisma.watch.create({
      data: { address, chain: typedChain, createdById: user.id },
    });
    await audit(user.id, "WATCH_ADD", null, { watchId: watch.id, address, chain: typedChain });
    return NextResponse.json(watch);
  } catch {
    // @@unique([address, chain, createdById]) — same person double-adding.
    return NextResponse.json({ error: "You are already watching this address on this chain" }, { status: 409 });
  }
}
