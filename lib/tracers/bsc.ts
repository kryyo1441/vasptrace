// LIVE: traces real BNB Chain transfers via Ankr (see lib/ankr.ts for why not
// Etherscan). Native BNB only for now — Ankr exposes BEP-20 transfers through
// a separate method, so stablecoin flows on this chain are not followed the
// way they are on Ethereum/Polygon/Arbitrum. That gap is stated in the UI
// through the same "no labels seeded" style warning rather than left silent.
import { getBscNativeBalance, getBscTransactions, hexToDecimalString } from "@/lib/ankr";
import { traceChain } from "./bfs";
import type { TraceGraph } from "./types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function traceBsc(rootAddress: string, maxDepth: number): Promise<TraceGraph> {
  return traceChain(
    {
      chain: "BSC",
      normalize: (a) => a.toLowerCase(),
      fetchOutgoing: async (address) => {
        const txs = await getBscTransactions(address);
        const from = address.toLowerCase();
        const transfers = txs
          // Ankr returns both directions for the queried address; only
          // outgoing transfers are hops in this trace.
          .filter((tx) => tx.from?.toLowerCase() === from)
          .filter((tx) => {
            const to = tx.to?.toLowerCase();
            return !!to && to !== ZERO_ADDRESS; // skip burns/contract creation
          })
          .map((tx) => ({
            to: tx.to as string,
            valueBaseUnits: hexToDecimalString(tx.value),
            txHash: tx.hash,
            timestamp: Number(BigInt(tx.timestamp || "0x0")),
          }));
        return { transfers };
      },
      fetchStats: async (address) => ({ balanceBaseUnits: await getBscNativeBalance(address) }),
    },
    rootAddress,
    maxDepth
  );
}
