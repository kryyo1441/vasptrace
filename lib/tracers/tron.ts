// LIVE: traces real on-chain Tron transfers via Tronscan, hop by hop.
import { getOutgoingTransfers } from "@/lib/tronscan";
import { traceChain } from "./bfs";
import type { TraceGraph } from "./types";

// ponytail: fixed delay, no measured Tronscan rate-limit tracking — same
// tradeoff as the Ethereum tracer's API_PACING_MS.
const API_PACING_MS = 250;

export async function traceTron(rootAddress: string, maxDepth: number): Promise<TraceGraph> {
  return traceChain(
    {
      chain: "TRON",
      normalize: (a) => a, // base58 addresses are case-sensitive
      pacingMs: API_PACING_MS,
      fetchOutgoing: async (address) => {
        const transfers = await getOutgoingTransfers(address);
        return transfers.map((t) => ({
          to: t.to,
          valueBaseUnits: t.valueSun,
          txHash: t.txHash,
          timestamp: t.timestamp,
        }));
      },
    },
    rootAddress,
    maxDepth
  );
}
