import { NextRequest, NextResponse } from "next/server";
import { traceEthereum } from "@/lib/tracers/ethereum";

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { address, chain, maxDepth = 5 } = body as { address?: string; chain?: string; maxDepth?: number };

  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  if (!chain || typeof chain !== "string") {
    return NextResponse.json({ error: "chain is required" }, { status: 400 });
  }
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 10) {
    return NextResponse.json({ error: "maxDepth must be an integer between 1 and 10" }, { status: 400 });
  }

  if (chain !== "ETHEREUM") {
    // Bitcoin and Tron tracers are on the roadmap — see CLAUDE.md priority order.
    return NextResponse.json({ error: `Tracing for chain "${chain}" is not implemented yet` }, { status: 501 });
  }

  if (!ETH_ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: "address is not a valid Ethereum address" }, { status: 400 });
  }

  try {
    const graph = await traceEthereum(address, maxDepth);
    return NextResponse.json(graph);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
