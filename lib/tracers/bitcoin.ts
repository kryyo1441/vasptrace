// LIVE: traces real on-chain Bitcoin transfers via Blockstream, hop by hop.
import { getOutgoingTransfers } from "@/lib/blockstream";
import { traceChain } from "./bfs";
import type { TraceGraph } from "./types";

// ponytail: fixed delay, no measured Blockstream rate-limit tracking — same
// tradeoff as the Ethereum tracer's API_PACING_MS.
const API_PACING_MS = 250;

export async function traceBitcoin(rootAddress: string, maxDepth: number): Promise<TraceGraph> {
  return traceChain(
    {
      chain: "BITCOIN",
      normalize: (a) => a, // base58/bech32 addresses are case-sensitive
      pacingMs: API_PACING_MS,
      fetchOutgoing: async (address) => {
        const transfers = await getOutgoingTransfers(address);
        return transfers.map((t) => ({
          to: t.to,
          valueBaseUnits: t.valueSats,
          txHash: t.txHash,
          timestamp: t.timestamp,
        }));
      },
    },
    rootAddress,
    maxDepth
  );
}
