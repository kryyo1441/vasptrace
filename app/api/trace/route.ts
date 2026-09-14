import { NextRequest, NextResponse } from "next/server";
import { traceArbitrum, traceEthereum, tracePolygon } from "@/lib/tracers/ethereum";
import { traceBitcoin } from "@/lib/tracers/bitcoin";
import { traceTron } from "@/lib/tracers/tron";
import { deriveRiskLevel } from "@/lib/scoring";
import { notifyN8n } from "@/lib/n8n";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { CHAIN_LABEL } from "@/lib/format";
import { ADDRESS_VALIDATORS, detectChains } from "@/lib/address";
import type { Chain } from "@/lib/generated/prisma/client";
import type { TraceGraph } from "@/lib/tracers/types";

const TRACERS: Record<Chain, (address: string, maxDepth: number) => Promise<TraceGraph>> = {
  ETHEREUM: traceEthereum,
  POLYGON: tracePolygon,
  ARBITRUM: traceArbitrum,
  BITCOIN: traceBitcoin,
  TRON: traceTron,
};

export async function POST(req: NextRequest) {
  // proxy.ts already turns away unauthenticated requests, but per Next's
  // own guidance (see proxy.ts's comment), re-check here rather than trust
  // the matcher covered this route.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { address: rawAddress, chain, maxDepth = 5 } = body as { address?: string; chain?: string; maxDepth?: number };

  if (!rawAddress || typeof rawAddress !== "string") {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  // Addresses get pasted out of PDFs, emails and chat, which carries
  // leading/trailing whitespace and newlines with them. app/page.tsx
  // already trims, but this is the trust boundary every caller crosses —
  // trimming here means the API is correct on its own terms, not because
  // its one current client happens to be careful.
  const address = rawAddress.trim();
  if (!chain || !(chain in ADDRESS_VALIDATORS)) {
    return NextResponse.json({ error: `chain must be one of ${Object.keys(TRACERS).join(", ")}` }, { status: 400 });
  }
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 10) {
    return NextResponse.json({ error: "maxDepth must be an integer between 1 and 10" }, { status: 400 });
  }

  const typedChain = chain as Chain;
  if (!ADDRESS_VALIDATORS[typedChain].test(address)) {
    // The likely mistake is a valid address pasted against the wrong chain
    // selector, so say which chain it *is* rather than only what it isn't.
    // A 0x address is valid on every EVM chain, so this can name several.
    const names = detectChains(address).map((c) => CHAIN_LABEL[c]);
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : names[0];
    return NextResponse.json(
      {
        error: list
          ? `That looks like ${/^[aeiou]/i.test(list) ? "an" : "a"} ${list} address, but ${CHAIN_LABEL[typedChain]} is selected — switch the chain selector to ${list}.`
          : `address is not a valid ${CHAIN_LABEL[typedChain]} address`,
      },
      { status: 400 }
    );
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
        createdById: user.id,
      },
    });

    await audit(user.id, "TRACE", savedCase.id, {
      address: graph.rootAddress,
      chain: graph.chain,
      maxDepth,
      nodeCount: graph.nodes.length,
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
