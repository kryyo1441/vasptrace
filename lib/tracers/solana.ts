// LIVE: traces real Solana transfers (native SOL + allowlisted USDT/USDC SPL)
// via public JSON-RPC, hop by hop. See lib/solana.ts for the per-hop cost.
import { getOutgoingSolana, getSolBalance } from "@/lib/solana";
import { traceChain, type OnProgress } from "./bfs";
import type { TraceGraph } from "./types";

export function traceSolana(rootAddress: string, maxDepth: number, onProgress?: OnProgress): Promise<TraceGraph> {
  return traceChain(
    {
      chain: "SOLANA",
      // Base58, case-sensitive — must not be case-folded.
      normalize: (a) => a,
      fetchOutgoing: async (address) => ({ transfers: await getOutgoingSolana(address) }),
      fetchStats: async (address) => ({ balanceBaseUnits: await getSolBalance(address) }),
    },
    rootAddress,
    maxDepth,
    onProgress
  );
}
