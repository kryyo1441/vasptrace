// Cross-case linking (added 2026-09-18): "this address also appears in N of
// your other cases". A shared *unlabeled* address — most often an inferred
// deposit address or a consolidation wallet — is the strongest link two
// complaints can have: it ties them to one operator even when the suspects'
// own wallets differ. PS 26182's "exchange clusters" and "case-based
// analytics", answered with data the app already stores.
//
// Two deliberate limits:
// - Labeled addresses (exchange hot wallets, mixers, sanctioned wallets) are
//   never linked on. Binance's hot wallet appears in dozens of unrelated
//   cases; linking on it would be noise dressed up as intelligence.
// - RBAC: callers pass only cases the viewer can open (an investigator's own,
//   or all for a SUPERVISOR). "Your address is in someone else's case" would
//   leak exactly what ARCHITECTURE.md's auth section exists to protect — that
//   this system associates an address with an investigation.
import { prisma } from "@/lib/prisma";
import type { Chain, Role } from "@/lib/generated/prisma/client";
import type { TraceGraph, TraceNode } from "@/lib/tracers/types";

export interface CaseLink {
  caseId: string;
  rootAddress: string;
  createdAt: string; // ISO — crosses the server/client boundary
}

export type LinkedCases = Record<string, CaseLink[]>;

function linkable(n: TraceNode) {
  return n.stopReason !== "LABEL_MATCH" && n.confidence !== "high";
}

export function findLinks(
  graph: Pick<TraceGraph, "nodes">,
  others: { id: string; address: string; createdAt: Date; traceResult: string | null }[]
): LinkedCases {
  const wanted = new Set(graph.nodes.filter(linkable).map((n) => n.address));
  const links: LinkedCases = {};
  for (const c of others) {
    if (!c.traceResult) continue;
    let other: TraceGraph;
    try {
      other = JSON.parse(c.traceResult);
    } catch {
      continue; // malformed/legacy blob — skip rather than fail the page
    }
    for (const n of other.nodes ?? []) {
      if (!wanted.has(n.address) || !linkable(n)) continue;
      (links[n.address] ??= []).push({ caseId: c.id, rootAddress: c.address, createdAt: c.createdAt.toISOString() });
    }
  }
  return links;
}

// ponytail: parses every accessible same-chain case's full traceResult on
// each call — O(cases) JSON parses per case view / trace. Fine at demo volume
// (~100 cases); at scale, write a CaseAddress(caseId, address) index row per
// linkable node at trace time and make this one indexed query.
export async function linkedCasesFor(
  graph: Pick<TraceGraph, "nodes">,
  chain: Chain,
  viewer: { id: string; role: Role },
  excludeCaseId: string
): Promise<LinkedCases> {
  const others = await prisma.case.findMany({
    where: {
      chain,
      id: { not: excludeCaseId },
      ...(viewer.role === "SUPERVISOR" ? {} : { createdById: viewer.id }),
    },
    select: { id: true, address: true, createdAt: true, traceResult: true },
  });
  return findLinks(graph, others);
}
