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

// Also "clustering heuristic match" (medium), Bitcoin only: common-input
// ownership. Addresses spent as inputs of one tx were signed for by one
// party, so if any of them is labeled, this address is that entity's wallet.
// Medium, not high, on purpose: it's an inference (CoinJoins are filtered
// upstream in lib/blockstream.ts, PayJoin isn't detectable). An exchange
// match does route a disclosure request, but only as an ownership-
// confirmation request that names the inference (lib/scoring.ts,
// lib/format.ts buildEmailDraft). The node is annotated, never merged — the
// graph still shows which address transacted.
// ponytail: direct co-spenders only, from the address's own ~25-tx window.
// Measured 2026-09-14: that alone attributed 5 of 60 nodes on
// 3FrmCRcG… to Binance; expanding the labeled addresses into their own
// clusters first added nothing new. Union-find across the trace if a case
// ever needs transitive A-with-B-with-label links.
export function applyCoSpendAttribution(
  nodes: TraceNode[],
  coSpendersByAddress: Map<string, Map<string, string>>,
  labelByAddress: Map<string, { entityName: string; labelType: string }>
): void {
  for (const node of nodes) {
    if (node.confidence) continue; // exact match wins
    for (const [peer, txHash] of coSpendersByAddress.get(node.address) ?? []) {
      const label = labelByAddress.get(peer);
      if (!label) continue;
      node.confidence = "medium";
      node.coSpend = { labeledAddress: peer, labelType: label.labelType, txHash };
      node.entityName = `${label.entityName} — same wallet`;
      node.confidenceReason = `Spent inputs together with known ${label.entityName} address ${peer} in tx ${txHash} — common-input ownership: one signer controls both`;
      break;
    }
  }
}

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
    // Share is taken within one asset: summing 6-decimal USDT with 18-decimal
    // wei would make any token edge's share round to 0%. A native-only node
    // has one group, so this is the old single total.
    const totalOutByAsset = new Map<string, bigint>();
    for (const e of outgoing) {
      const k = e.asset?.contract ?? "";
      totalOutByAsset.set(k, (totalOutByAsset.get(k) ?? BigInt(0)) + BigInt(e.valueWei));
    }

    for (const edge of outgoing) {
      const totalOut = totalOutByAsset.get(edge.asset?.contract ?? "")!;
      if (totalOut === BigInt(0)) continue;
      const dest = byAddress.get(edge.to);
      if (!dest || dest.kind !== "EXCHANGE" || dest.confidence !== "high" || !dest.entityName) continue;
      const shareBps = Number((BigInt(edge.valueWei) * BigInt(10000)) / totalOut);
      if (shareBps / 10000 >= MEDIUM_FORWARD_RATIO) {
        node.confidence = "medium";
        node.entityName = `${dest.entityName} (inferred deposit address)`;
        node.confidenceReason = `Forwards ${(shareBps / 100).toFixed(0)}% of its outgoing ${edge.asset?.symbol ?? "native-currency value"} to a known ${dest.entityName} address`;
        break;
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
