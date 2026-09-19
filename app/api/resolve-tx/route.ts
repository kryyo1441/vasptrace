// Transaction-hash intake (added 2026-09-18) — see lib/txresolve.ts for why.
// Session-gated like /api/trace: this is a live API call an investigator
// triggers, not a machine endpoint.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ADDRESS_VALIDATORS } from "@/lib/address";
import { isTxHash, resolveTxRecipients } from "@/lib/txresolve";
import type { Chain } from "@/lib/generated/prisma/client";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const hash = typeof body?.hash === "string" ? body.hash.trim() : "";
  const chain = body?.chain as string | undefined;
  if (!hash || !chain || !(chain in ADDRESS_VALIDATORS)) {
    return NextResponse.json({ error: "hash and a valid chain are required" }, { status: 400 });
  }
  const typedChain = chain as Chain;
  if (!isTxHash(hash, typedChain)) {
    return NextResponse.json({ error: `${hash.slice(0, 12)}… doesn't look like a transaction hash on this chain` }, { status: 400 });
  }

  try {
    const recipients = await resolveTxRecipients(hash, typedChain);
    if (recipients === null) {
      return NextResponse.json({ error: "No such transaction found on this chain" }, { status: 404 });
    }
    if (recipients.length === 0) {
      return NextResponse.json({ error: "This transaction moved no traceable value (reverted, or only untracked tokens)" }, { status: 400 });
    }
    return NextResponse.json({ recipients });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
