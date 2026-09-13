// LIVE: traces real on-chain Tron transfers (native TRX + USDT-TRC20) via
// Tronscan, hop by hop.
import { getOutgoingTransfers, getOutgoingUsdtTransfers } from "@/lib/tronscan";
import { traceChain } from "./bfs";
import type { TraceGraph } from "./types";

export async function traceTron(rootAddress: string, maxDepth: number): Promise<TraceGraph> {
  return traceChain(
    {
      chain: "TRON",
      normalize: (a) => a, // base58 addresses are case-sensitive
      fetchOutgoing: async (address) => {
        const [native, usdt] = await Promise.all([getOutgoingTransfers(address), getOutgoingUsdtTransfers(address)]);
        return [...native, ...usdt];
      },
    },
    rootAddress,
    maxDepth
  );
}
