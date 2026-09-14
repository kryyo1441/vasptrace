// Shared hop-by-hop traversal engine (SIH plan item 1) — the BFS/budget/
// labeling logic is identical across chains; only "how do I fetch this
// address's outgoing transfers" differs. Each chain's tracer (ethereum.ts,
// bitcoin.ts, tron.ts) is a thin adapter around this.
import { prisma } from "@/lib/prisma";
import { recommendVasp } from "@/lib/scoring";
import { applyTypologyFlags } from "@/lib/typology";
import { applyCoSpendAttribution, applyConfidenceClustering } from "@/lib/clustering";
import type { Chain } from "@/lib/generated/prisma/client";
import type { NodeKind, TraceAsset, TraceEdge, TraceGraph, TraceNode } from "./types";

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
  valueBaseUnits: string; // of `asset` if set, else wei / satoshis / sun — decimal string
  txHash: string;
  timestamp: number; // unix seconds
  asset?: TraceAsset; // absent = native currency
}

export interface ChainAdapter {
  chain: Chain;
  // Base58/bech32 (BTC, TRON) addresses are case-sensitive; Ethereum's hex
  // addresses aren't, so its adapter normalizes to lowercase.
  normalize: (address: string) => string;
  // coSpenders: addresses that signed inputs alongside this one, each with
  // one evidence tx hash. Bitcoin only (UTXO inputs); account chains omit it.
  fetchOutgoing: (address: string) => Promise<{ transfers: RawTransfer[]; coSpenders?: Map<string, string> }>;
}

export async function traceChain(adapter: ChainAdapter, rootAddress: string, maxDepth: number): Promise<TraceGraph> {
  const root = adapter.normalize(rootAddress);

  const labels = await prisma.labeledAddress.findMany({ where: { chain: adapter.chain } });
  const labelByAddress = new Map(labels.map((l) => [adapter.normalize(l.address), l]));

  const nodes = new Map<string, TraceNode>();
  const edges: TraceEdge[] = [];
  const warnings: string[] = [];
  const coSpendersByAddress = new Map<string, Map<string, string>>();

  // Arbitrum ships with no seeded labels (nothing there could be verified —
  // see prisma/seed.ts). Without this, its "No labeled VASP reached" state
  // reads as "the funds never touched an exchange" when the truth is "we
  // can't recognise one on this chain".
  if (labels.length === 0) {
    warnings.push(
      `No labeled addresses are seeded for ${adapter.chain} yet — this trace can't recognise an exchange or mixer, so "no VASP reached" doesn't mean none was.`
    );
  }

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
      const fetched = await adapter.fetchOutgoing(address);
      transfers = fetched.transfers;
      if (fetched.coSpenders) coSpendersByAddress.set(address, fetched.coSpenders);
    } catch (err) {
      node.stopReason = "API_ERROR";
      warnings.push(`Failed to fetch transactions for ${address}: ${(err as Error).message}`);
      continue;
    }

    // Aggregate outgoing transfers per destination and asset (skip
    // self/change) — 6-decimal USDT can't be summed with 18-decimal ETH.
    const byDest = new Map<
      string,
      { to: string; asset?: TraceAsset; valueBaseUnits: bigint; txCount: number; latestTxHash: string; latestTimestamp: number }
    >();
    for (const t of transfers) {
      const to = adapter.normalize(t.to);
      if (!to || to === address) continue;
      const value = BigInt(t.valueBaseUnits || "0");
      const key = `${to}|${t.asset?.contract ?? ""}`;
      const existing = byDest.get(key);
      if (existing) {
        existing.valueBaseUnits += value;
        existing.txCount += 1;
        if (t.timestamp > existing.latestTimestamp) {
          existing.latestTimestamp = t.timestamp;
          existing.latestTxHash = t.txHash;
        }
      } else {
        byDest.set(key, { to, asset: t.asset, valueBaseUnits: value, txCount: 1, latestTxHash: t.txHash, latestTimestamp: t.timestamp });
      }
    }

    // FANOUT_CAP applies per asset: one value sort across assets would rank
    // wei against USDT's 6-decimal units and bury every token transfer.
    // Native-only nodes get exactly the old sort-then-slice.
    const takenPerAsset = new Map<string, number>();
    const topDestinations = [...byDest.values()]
      .sort((a, b) => (b.valueBaseUnits > a.valueBaseUnits ? 1 : -1))
      .filter((agg) => {
        const assetKey = agg.asset?.contract ?? "";
        const taken = takenPerAsset.get(assetKey) ?? 0;
        takenPerAsset.set(assetKey, taken + 1);
        return taken < FANOUT_CAP;
      });

    for (const agg of topDestinations) {
      const to = agg.to;
      edges.push({
        from: address,
        to,
        valueWei: agg.valueBaseUnits.toString(),
        ...(agg.asset && { asset: agg.asset }),
        // ponytail: classified from aggregate value alone, not from calldata
        // — an edge that moved zero value across every one of its
        // transactions moved no money, whatever the reason. That misnames
        // one rare shape: a genuine zero-value native send to an EOA (no
        // calldata) is reported as CONTRACT_CALL. To tell them apart
        // properly, carry a hasCalldata flag on RawTransfer from each chain
        // adapter (Etherscan exposes `input`; Bitcoin has no equivalent).
        kind: agg.valueBaseUnits === BigInt(0) ? "CONTRACT_CALL" : "TRANSFER",
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
  // Co-spend first: a same-wallet attribution is direct evidence, so it
  // should win over the forwards-80%-to-an-exchange inference, which skips
  // any node that already has a confidence.
  applyCoSpendAttribution(nodeList, coSpendersByAddress, labelByAddress);
  applyConfidenceClustering(nodeList, edges);
  applyTypologyFlags(nodeList, edges);

  return {
    rootAddress: root,
    chain: adapter.chain,
    maxDepth,
    nodes: nodeList,
    edges,
    warnings,
    recommendation: recommendVasp(nodeList, vaspRegistry),  };
}
