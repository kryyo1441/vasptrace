import { NextRequest, NextResponse } from "next/server";
import { traceEthereum } from "@/lib/tracers/ethereum";
import { deriveRiskLevel } from "@/lib/scoring";
import { prisma } from "@/lib/prisma";

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

    // Persist every completed trace as a Case (SIH plan item 7 — dashboard
    // needs a list of past traces, not just the live results view).
    const typologyFlags = Array.from(new Set(graph.nodes.flatMap((n) => n.typologyFlags)));
    await prisma.case.create({
      data: {
        address: graph.rootAddress,
        chain: "ETHEREUM",
        status: "TRACED",
        riskLevel: deriveRiskLevel(graph.nodes, typologyFlags),
        // VaspRegistry.name is @unique, so it doubles as a stable id here
        // without threading vasp.id through the recommendation type.
        recommendedVaspId: graph.recommendation?.top.vaspName ?? null,
        traceResult: JSON.stringify(graph),
        typologyFlags: JSON.stringify(typologyFlags),
      },
    });

    return NextResponse.json(graph);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
