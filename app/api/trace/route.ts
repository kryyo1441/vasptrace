import { NextRequest, NextResponse } from "next/server";
import { traceEthereum } from "@/lib/tracers/ethereum";
import { traceBitcoin } from "@/lib/tracers/bitcoin";
import { traceTron } from "@/lib/tracers/tron";
import { deriveRiskLevel } from "@/lib/scoring";
import { notifyN8n } from "@/lib/n8n";
import { prisma } from "@/lib/prisma";
import type { Chain } from "@/lib/generated/prisma/client";
import type { TraceGraph } from "@/lib/tracers/types";

const ADDRESS_VALIDATORS: Record<Chain, RegExp> = {
  ETHEREUM: /^0x[a-fA-F0-9]{40}$/,
  BITCOIN: /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,90})$/,
  TRON: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
};

const TRACERS: Record<Chain, (address: string, maxDepth: number) => Promise<TraceGraph>> = {
  ETHEREUM: traceEthereum,
  BITCOIN: traceBitcoin,
  TRON: traceTron,
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { address, chain, maxDepth = 5 } = body as { address?: string; chain?: string; maxDepth?: number };

  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  if (!chain || !(chain in ADDRESS_VALIDATORS)) {
    return NextResponse.json({ error: "chain must be one of ETHEREUM, BITCOIN, TRON" }, { status: 400 });
  }
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 10) {
    return NextResponse.json({ error: "maxDepth must be an integer between 1 and 10" }, { status: 400 });
  }

  const typedChain = chain as Chain;
  if (!ADDRESS_VALIDATORS[typedChain].test(address)) {
    return NextResponse.json({ error: `address is not a valid ${typedChain} address` }, { status: 400 });
  }

  try {
    const graph = await TRACERS[typedChain](address, maxDepth);

    // Persist every completed trace as a Case (SIH plan item 7 — dashboard
    // needs a list of past traces, not just the live results view).
    const typologyFlags = Array.from(new Set(graph.nodes.flatMap((n) => n.typologyFlags)));
    const savedCase = await prisma.case.create({
      data: {
        address: graph.rootAddress,
        chain: graph.chain,
        status: "TRACED",
        riskLevel: deriveRiskLevel(graph.nodes, typologyFlags),
        // VaspRegistry.name is @unique, so it doubles as a stable id here
        // without threading vasp.id through the recommendation type.
        recommendedVaspId: graph.recommendation?.top.vaspName ?? null,
        traceResult: JSON.stringify(graph),
        typologyFlags: JSON.stringify(typologyFlags),
      },
    });

    // SIH plan item 6 — mirror this hop-by-hop pipeline on n8n's canvas for
    // demo visibility. Fire-and-forget: never blocks or fails the trace
    // that already completed and was already persisted above.
    const n8nWarning = await notifyN8n(process.env.N8N_TRACE_WEBHOOK_URL, {
      caseId: savedCase.id,
      address: graph.rootAddress,
      chain: graph.chain,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      hitVaspOrMixer: graph.nodes.some((n) => n.stopReason === "LABEL_MATCH"),
      recommendedVasp: graph.recommendation?.top.vaspName ?? null,
    });

    return NextResponse.json({
      ...graph,
      caseId: savedCase.id,
      warnings: n8nWarning ? [...graph.warnings, n8nWarning] : graph.warnings,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
