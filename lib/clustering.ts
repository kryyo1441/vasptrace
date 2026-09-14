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
// Transitive links (A co-spent with B, B co-spent with a label) are followed
// across the trace's own nodes, both directions, to a fixpoint. They stay
// medium and are marked `coSpendVia`, but never get `coSpend`, so they never
// route: the disclosure draft cites *one* tx between the address and the
// known VASP address, and a transitive link has no such tx.
// ponytail: only addresses the trace expanded contribute co-spender data;
// a link through an address outside the trace is invisible.
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

  // Symmetric peer list: B's tx can prove the A-B link even if A's window
  // didn't contain it.
  const peers = new Map<string, Map<string, string>>();
  for (const [a, map] of coSpendersByAddress) {
    for (const [b, tx] of map) {
      if (!peers.has(a)) peers.set(a, new Map());
      if (!peers.has(b)) peers.set(b, new Map());
      peers.get(a)!.set(b, tx);
      if (!peers.get(b)!.has(a)) peers.get(b)!.set(a, tx);
    }
  }
  const byAddress = new Map(nodes.map((n) => [n.address, n]));
  for (let changed = true; changed; ) {
    changed = false;
    for (const node of nodes) {
      if (node.confidence) continue;
      for (const [peer, txHash] of peers.get(node.address) ?? []) {
        const via = byAddress.get(peer);
        if (!via || (!via.coSpend && !via.coSpendVia)) continue;
        node.confidence = "medium";
        node.coSpendVia = { address: peer, txHash };
        node.entityName = via.entityName!.endsWith("(transitive)") ? via.entityName : `${via.entityName} (transitive)`;
        node.confidenceReason = `Spent inputs together with ${peer} in tx ${txHash}, which is itself attributed — transitive common-input ownership, not a direct link to a known address, so it can't route a request`;
        changed = true;
        break;
      }
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
