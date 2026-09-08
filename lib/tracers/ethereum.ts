// LIVE: traces real on-chain Ethereum transfers via Etherscan, hop by hop.
import { getOutgoingTransactions } from "@/lib/etherscan";
import { traceChain } from "./bfs";
import type { TraceGraph } from "./types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function traceEthereum(rootAddress: string, maxDepth: number): Promise<TraceGraph> {
  return traceChain(
    {
      chain: "ETHEREUM",
      normalize: (a) => a.toLowerCase(),
      fetchOutgoing: async (address) => {
        const txs = await getOutgoingTransactions(address);
        return txs
          .filter((tx) => {
            const to = tx.to?.toLowerCase();
            return to && to !== ZERO_ADDRESS; // skip burns/contract creation
          })
          .map((tx) => ({
            to: tx.to,
            valueBaseUnits: tx.value || "0",
            txHash: tx.hash,
            timestamp: Number(tx.timeStamp),
          }));
      },
    },
    rootAddress,
    maxDepth
  );
}
