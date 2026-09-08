// Shared hop-by-hop traversal engine (SIH plan item 1) — the BFS/budget/
// labeling logic is identical across chains; only "how do I fetch this
// address's outgoing transfers" differs. Each chain's tracer (ethereum.ts,
// bitcoin.ts, tron.ts) is a thin adapter around this.
import { prisma } from "@/lib/prisma";
import { recommendVasp } from "@/lib/scoring";
import { applyTypologyFlags } from "@/lib/typology";
import { applyConfidenceClustering } from "@/lib/clustering";
import type { Chain } from "@/lib/generated/prisma/client";
import type { NodeKind, TraceEdge, TraceGraph, TraceNode } from "./types";

// ponytail: fixed caps instead of adaptive backpressure. A wallet with
// thousands of counterparties would blow the API budget; ranking by value
// and capping breadth keeps a demo trace fast and bounded. Raise these (or
// make them request params) if real caseloads need deeper fan-out.
const FANOUT_CAP = 5;
const NODE_BUDGET = 60;

// One outgoing transfer as reported by a chain-specific API client, before
// aggregation by destination.
export interface RawTransfer {
  to: string;
  valueBaseUnits: string; // wei / satoshis / sun, as a decimal string
  txHash: string;
  timestamp: number; // unix seconds
}

export interface ChainAdapter {
  chain: Chain;
  // Base58/bech32 (BTC, TRON) addresses are case-sensitive; Ethereum's hex
  // addresses aren't, so its adapter normalizes to lowercase.
  normalize: (address: string) => string;
  fetchOutgoing: (address: string) => Promise<RawTransfer[]>;
}

export async function traceChain(adapter: ChainAdapter, rootAddress: string, maxDepth: number): Promise<TraceGraph> {
  const root = adapter.normalize(rootAddress);

  const labels = await prisma.labeledAddress.findMany({ where: { chain: adapter.chain } });
  const labelByAddress = new Map(labels.map((l) => [adapter.normalize(l.address), l]));

  const nodes = new Map<string, TraceNode>();
  const edges: TraceEdge[] = [];
  const warnings: string[] = [];

  nodes.set(root, {
    address: root,
    depth: 0,
    kind: "SUSPECT",
    confidence: null,
    stopReason: null,
    typologyFlags: [],
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

    let transfers: RawTransfer[];
    try {
      // API pacing (rate-limit safety) lives in each chain's API client
      // (lib/etherscan.ts etc, via lib/rateLimit.ts) — global per-process,
      // not per-trace, so it also holds up under concurrent traces.
      transfers = await adapter.fetchOutgoing(address);
    } catch (err) {
      node.stopReason = "API_ERROR";
      warnings.push(`Failed to fetch transactions for ${address}: ${(err as Error).message}`);
      continue;
    }

    // Aggregate outgoing transfers per destination (skip self/change).
    const byDest = new Map<string, { valueBaseUnits: bigint; txCount: number; latestTxHash: string; latestTimestamp: number }>();
    for (const t of transfers) {
      const to = adapter.normalize(t.to);
      if (!to || to === address) continue;
      const value = BigInt(t.valueBaseUnits || "0");
      const existing = byDest.get(to);
      if (existing) {
        existing.valueBaseUnits += value;
        existing.txCount += 1;
        if (t.timestamp > existing.latestTimestamp) {
          existing.latestTimestamp = t.timestamp;
          existing.latestTxHash = t.txHash;
        }
      } else {
        byDest.set(to, { valueBaseUnits: value, txCount: 1, latestTxHash: t.txHash, latestTimestamp: t.timestamp });
      }
    }

    const topDestinations = [...byDest.entries()]
      .sort((a, b) => (b[1].valueBaseUnits > a[1].valueBaseUnits ? 1 : -1))
      .slice(0, FANOUT_CAP);

    for (const [to, agg] of topDestinations) {
      edges.push({
        from: address,
        to,
        valueWei: agg.valueBaseUnits.toString(),
        txCount: agg.txCount,
        latestTxHash: agg.latestTxHash,
        latestTimestamp: agg.latestTimestamp,
        typologyFlags: [],
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
          typologyFlags: [],
        });
        queue.push({ address: to, depth: depth + 1 });
      }
    }
  }

  if (nodes.size >= NODE_BUDGET) {
    warnings.push(`Node budget (${NODE_BUDGET}) reached — trace truncated before completing all branches.`);
  }

  const vaspRegistry = await prisma.vaspRegistry.findMany();
  const nodeList = [...nodes.values()];
  applyConfidenceClustering(nodeList, edges);
  applyTypologyFlags(nodeList, edges);

  return {
    rootAddress: root,
    chain: adapter.chain,
    maxDepth,
    nodes: nodeList,
    edges,
    warnings,
    recommendation: recommendVasp(nodeList, vaspRegistry),
  };
}
