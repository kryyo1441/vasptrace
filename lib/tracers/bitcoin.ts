// LIVE: traces real on-chain Bitcoin transfers via Blockstream, hop by hop.
import { getOutgoingTransfers } from "@/lib/blockstream";
import { traceChain } from "./bfs";
import type { TraceGraph } from "./types";

export async function traceBitcoin(rootAddress: string, maxDepth: number): Promise<TraceGraph> {
  return traceChain(
    {
      chain: "BITCOIN",
      normalize: (a) => a, // base58/bech32 addresses are case-sensitive
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
