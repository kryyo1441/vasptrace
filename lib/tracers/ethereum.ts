// LIVE: traces real on-chain Ethereum transfers via Etherscan, hop by hop.
import { prisma } from "@/lib/prisma";
import { getOutgoingTransactions } from "@/lib/etherscan";
import type { NodeKind, TraceEdge, TraceGraph, TraceNode } from "@/lib/tracers/types";

// ponytail: fixed caps instead of adaptive backpressure. A wallet with
// thousands of counterparties would blow the API budget; ranking by value
// and capping breadth keeps a demo trace fast and bounded. Raise these (or
// make them request params) if real caseloads need deeper fan-out.
const FANOUT_CAP = 5;
const NODE_BUDGET = 60;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ponytail: fixed delay instead of tracking Etherscan's actual rate-limit
// window. Free-tier keys throttle bursty sequential calls; this is cheaper
// than a token-bucket for a demo trace. Remove/tune if a paid key is used.
const API_PACING_MS = 250;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function traceEthereum(rootAddress: string, maxDepth: number): Promise<TraceGraph> {
  const root = rootAddress.toLowerCase();

  const labels = await prisma.labeledAddress.findMany({ where: { chain: "ETHEREUM" } });
  const labelByAddress = new Map(labels.map((l) => [l.address.toLowerCase(), l]));

  const nodes = new Map<string, TraceNode>();
  const edges: TraceEdge[] = [];
  const warnings: string[] = [];

  nodes.set(root, {
    address: root,
    depth: 0,
    kind: "SUSPECT",
    confidence: null,
    stopReason: null,
  });

  const queue: { address: string; depth: number }[] = [{ address: root, depth: 0 }];

  while (queue.length > 0 && nodes.size < NODE_BUDGET) {
    const { address, depth } = queue.shift()!;
    const node = nodes.get(address)!;

    if (node.stopReason) continue; // labeled stop or already flagged, don't expand
    if (depth >= maxDepth) {
      node.stopReason = "MAX_DEPTH";
      continue;
    }

    let txs;
    try {
      if (nodes.size > 1) await sleep(API_PACING_MS);
      txs = await getOutgoingTransactions(address);
    } catch (err) {
      node.stopReason = "API_ERROR";
      warnings.push(`Failed to fetch transactions for ${address}: ${(err as Error).message}`);
      continue;
    }

    // Aggregate outgoing transfers per destination (skip self, burns, contract creation).
    const byDest = new Map<string, { valueWei: bigint; txCount: number; latestTxHash: string; latestTimestamp: number }>();
    for (const tx of txs) {
      const to = tx.to?.toLowerCase();
      if (!to || to === address || to === ZERO_ADDRESS) continue;
      const value = BigInt(tx.value || "0");
      const ts = Number(tx.timeStamp);
      const existing = byDest.get(to);
      if (existing) {
        existing.valueWei += value;
        existing.txCount += 1;
        if (ts > existing.latestTimestamp) {
          existing.latestTimestamp = ts;
          existing.latestTxHash = tx.hash;
        }
      } else {
        byDest.set(to, { valueWei: value, txCount: 1, latestTxHash: tx.hash, latestTimestamp: ts });
      }
    }

    const topDestinations = [...byDest.entries()]
      .sort((a, b) => (b[1].valueWei > a[1].valueWei ? 1 : -1))
      .slice(0, FANOUT_CAP);

    for (const [to, agg] of topDestinations) {
      edges.push({
        from: address,
        to,
        valueWei: agg.valueWei.toString(),
        txCount: agg.txCount,
        latestTxHash: agg.latestTxHash,
        latestTimestamp: agg.latestTimestamp,
      });

      if (!nodes.has(to) && nodes.size < NODE_BUDGET) {
        const label = labelByAddress.get(to);
        const kind: NodeKind = label ? (label.labelType as NodeKind) : "INTERMEDIARY";
        nodes.set(to, {
          address: to,
          depth: depth + 1,
          kind,
          entityName: label?.entityName,
          source: label?.source,
          confidence: label ? "high" : null,
          stopReason: label ? "LABEL_MATCH" : null,
        });
        queue.push({ address: to, depth: depth + 1 });
      }
    }
  }

  if (nodes.size >= NODE_BUDGET) {
    warnings.push(`Node budget (${NODE_BUDGET}) reached — trace truncated before completing all branches.`);
  }

  return {
    rootAddress: root,
    chain: "ETHEREUM",
    maxDepth,
    nodes: [...nodes.values()],
    edges,
    warnings,
  };
}
