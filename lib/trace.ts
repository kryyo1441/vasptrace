// Shared by both trace entry points: the session-gated app/api/trace (a
// human investigator, via the UI) and the bearer-token-gated
// app/api/sahyog/trace (an automated caller, e.g. the Sahyog Portal — problem
// statement 26182 asks for exactly this: "automatically analyze suspect
// cryptocurrency wallet addresses reported during investigations on the
// Sahyog Platform"). One implementation, so a change to validation or
// persistence can't drift between the two callers.
import { traceArbitrum, traceEthereum, tracePolygon } from "@/lib/tracers/ethereum";
import { traceBitcoin } from "@/lib/tracers/bitcoin";
import { traceTron } from "@/lib/tracers/tron";
import { traceBsc } from "@/lib/tracers/bsc";
import { deriveRiskLevel } from "@/lib/scoring";
import { notifyN8n } from "@/lib/n8n";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { CHAIN_LABEL } from "@/lib/format";
import { ADDRESS_VALIDATORS, detectChains } from "@/lib/address";
import type { Chain } from "@/lib/generated/prisma/client";
import type { TraceGraph } from "@/lib/tracers/types";

export const TRACERS: Record<Chain, (address: string, maxDepth: number) => Promise<TraceGraph>> = {
  ETHEREUM: traceEthereum,
  POLYGON: tracePolygon,
  ARBITRUM: traceArbitrum,
  BSC: traceBsc,
  BITCOIN: traceBitcoin,
  TRON: traceTron,
};

export type TraceInput = { address: string; chain: Chain; maxDepth: number };
export type TraceInputError = { error: string; status: number };

export function parseTraceInput(body: unknown): TraceInput | TraceInputError {
  const { address: rawAddress, chain, maxDepth = 5 } = (body ?? {}) as {
    address?: string;
    chain?: string;
    maxDepth?: number;
  };

  if (!rawAddress || typeof rawAddress !== "string") {
    return { error: "address is required", status: 400 };
  }
  // Addresses get pasted out of PDFs, emails and chat, which carries
  // leading/trailing whitespace and newlines with them. Trimming here means
  // every caller of this function is correct on its own terms, not because
  // it happens to be careful upstream.
  const address = rawAddress.trim();
  if (!chain || !(chain in ADDRESS_VALIDATORS)) {
    return { error: `chain must be one of ${Object.keys(TRACERS).join(", ")}`, status: 400 };
  }
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 10) {
    return { error: "maxDepth must be an integer between 1 and 10", status: 400 };
  }

  const typedChain = chain as Chain;
  if (!ADDRESS_VALIDATORS[typedChain].test(address)) {
    // The likely mistake is a valid address paired with the wrong chain, so
    // say which chain it *is* rather than only what it isn't. A 0x address
    // is valid on every EVM chain, so this can name several.
    const names = detectChains(address).map((c) => CHAIN_LABEL[c]);
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : names[0];
    return {
      error: list
        ? `That looks like ${/^[aeiou]/i.test(list) ? "an" : "a"} ${list} address, but ${CHAIN_LABEL[typedChain]} is selected — switch the chain selector to ${list}.`
        : `address is not a valid ${CHAIN_LABEL[typedChain]} address`,
      status: 400,
    };
  }

  return { address, chain: typedChain, maxDepth };
}

export function isTraceInputError(v: TraceInput | TraceInputError): v is TraceInputError {
  return "error" in v;
}

/**
 * Runs a trace, persists it as a Case, notifies n8n (fire-and-forget), and
 * audits the action. `createdById` is `null` for an automated caller with no
 * human investigator behind it — the same nullable field already used for
 * the pre-auth cases (see prisma/schema.prisma's Case.createdById comment).
 */
export async function runTrace(input: TraceInput, createdById: string | null, source?: "sahyog") {
  const graph = await TRACERS[input.chain](input.address, input.maxDepth);

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
      createdById,
    },
  });

  await audit(createdById, "TRACE", savedCase.id, {
    address: graph.rootAddress,
    chain: graph.chain,
    maxDepth: input.maxDepth,
    nodeCount: graph.nodes.length,
    ...(source ? { source } : {}),
  });

  // SIH plan item 6 — mirror this hop-by-hop pipeline on n8n's canvas for
  // demo visibility. Fire-and-forget: never blocks or fails the trace that
  // already completed and was already persisted above.
  const n8nWarning = await notifyN8n(process.env.N8N_TRACE_WEBHOOK_URL, {
    caseId: savedCase.id,
    address: graph.rootAddress,
    chain: graph.chain,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    hitVaspOrMixer: graph.nodes.some((n) => n.stopReason === "LABEL_MATCH"),
    recommendedVasp: graph.recommendation?.top.vaspName ?? null,
  });

  return {
    graph,
    caseId: savedCase.id,
    warnings: n8nWarning ? [...graph.warnings, n8nWarning] : graph.warnings,
  };
}
