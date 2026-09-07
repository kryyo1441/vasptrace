// Confidence tiers beyond exact match (SIH plan item 4). Runs after a full
// trace since both heuristics need the whole edge list (in-degree/out-degree
// per node), not just per-hop data — same shape as lib/typology.ts.
// Chain-agnostic: operates on the abstract TraceNode/TraceEdge graph, not
// chain-specific transaction fields, so the same rules apply to BTC/ETH/TRON.
import type { TraceEdge, TraceNode } from "@/lib/tracers/types";

// "Clustering heuristic match" (medium): this address isn't itself labeled,
// but it forwards most of its outgoing value to one address we're already
// certain (high confidence) is a known exchange — behavior typical of a
// deposit-collection wallet the exchange controls but hasn't published.
const MEDIUM_FORWARD_RATIO = 0.8;

// "Pattern-based guess" (low): many distinct senders funnel into one
// forwarding address — the shape of an unlabeled deposit/consolidation
// address, but with no specific attribution (we don't know *which* exchange,
// if any).
const LOW_FANIN_MIN_SENDERS = 3;

function pushTo(map: Map<string, TraceEdge[]>, key: string, edge: TraceEdge) {
  const list = map.get(key);
  if (list) list.push(edge);
  else map.set(key, [edge]);
}

export function applyConfidenceClustering(nodes: TraceNode[], edges: TraceEdge[]): void {
  const byAddress = new Map(nodes.map((n) => [n.address, n]));
  const outgoingByAddress = new Map<string, TraceEdge[]>();
  const incomingByAddress = new Map<string, TraceEdge[]>();
  for (const edge of edges) {
    pushTo(outgoingByAddress, edge.from, edge);
    pushTo(incomingByAddress, edge.to, edge);
  }

  for (const node of nodes) {
    if (node.confidence) continue; // already an exact match, don't override

    const outgoing = outgoingByAddress.get(node.address) ?? [];
    const totalOut = outgoing.reduce((sum, e) => sum + BigInt(e.valueWei), BigInt(0));

    if (totalOut > BigInt(0)) {
      for (const edge of outgoing) {
        const dest = byAddress.get(edge.to);
        if (!dest || dest.kind !== "EXCHANGE" || dest.confidence !== "high" || !dest.entityName) continue;
        const shareBps = Number((BigInt(edge.valueWei) * BigInt(10000)) / totalOut);
        if (shareBps / 10000 >= MEDIUM_FORWARD_RATIO) {
          node.confidence = "medium";
          node.entityName = `${dest.entityName} (inferred deposit address)`;
          node.confidenceReason = `Forwards ${(shareBps / 100).toFixed(0)}% of its outgoing value to a known ${dest.entityName} address`;
          break;
        }
      }
    }

    if (!node.confidence) {
      const incoming = incomingByAddress.get(node.address) ?? [];
      const distinctSenders = new Set(incoming.map((e) => e.from)).size;
      if (distinctSenders >= LOW_FANIN_MIN_SENDERS && outgoing.length > 0) {
        node.confidence = "low";
        node.confidenceReason = `${distinctSenders} distinct addresses send here and it forwards onward — pattern resembles an unlabeled deposit/consolidation address`;
      }
    }
  }
}
