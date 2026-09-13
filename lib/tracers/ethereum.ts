// LIVE: traces real on-chain Ethereum transfers (native ETH + allowlisted
// ERC-20 stablecoins) via Etherscan, hop by hop.
import { ERC20_ALLOWLIST, getOutgoingTokenTransfers, getOutgoingTransactions } from "@/lib/etherscan";
import { traceChain } from "./bfs";
import type { TraceGraph } from "./types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function traceEthereum(rootAddress: string, maxDepth: number): Promise<TraceGraph> {
  return traceChain(
    {
      chain: "ETHEREUM",
      normalize: (a) => a.toLowerCase(),
      fetchOutgoing: async (address) => {
        const [txs, tokenTxs] = await Promise.all([getOutgoingTransactions(address), getOutgoingTokenTransfers(address)]);

        // A USDT send is *also* a zero-value tx into the USDT contract in
        // txlist, under the same hash. Keep both and every token transfer
        // draws twice: once to its real recipient, once as a phantom
        // contract-call edge to Tether (ROADMAP.md items 0 and 1). Only an
        // allowlisted transfer replaces its tx — any other token send keeps
        // its CONTRACT_CALL edge to the token contract, as before.
        const tokenHashes = new Set(tokenTxs.map((t) => t.hash));

        const native = txs
          .filter((tx) => {
            const to = tx.to?.toLowerCase();
            if (!to || to === ZERO_ADDRESS) return false; // skip burns/contract creation
            return !(tx.value === "0" && tokenHashes.has(tx.hash));
          })
          .map((tx) => ({
            to: tx.to,
            valueBaseUnits: tx.value || "0",
            txHash: tx.hash,
            timestamp: Number(tx.timeStamp),
          }));

        const tokens = tokenTxs
          .filter((t) => t.to && t.to.toLowerCase() !== ZERO_ADDRESS)
          .map((t) => ({
            to: t.to,
            valueBaseUnits: t.value,
            txHash: t.hash,
            timestamp: Number(t.timeStamp),
            asset: ERC20_ALLOWLIST[t.contractAddress.toLowerCase()],
          }));

        return [...native, ...tokens];
      },
    },
    rootAddress,
    maxDepth
  );
}
