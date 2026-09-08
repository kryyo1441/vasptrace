// LIVE: traces real on-chain Tron transfers via Tronscan, hop by hop.
import { getOutgoingTransfers } from "@/lib/tronscan";
import { traceChain } from "./bfs";
import type { TraceGraph } from "./types";

export async function traceTron(rootAddress: string, maxDepth: number): Promise<TraceGraph> {
  return traceChain(
    {
      chain: "TRON",
      normalize: (a) => a, // base58 addresses are case-sensitive
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
