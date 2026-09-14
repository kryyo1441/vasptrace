// LIVE: traces real on-chain EVM transfers (native coin + allowlisted ERC-20
// stablecoins) via Etherscan v2, hop by hop. Ethereum, Polygon and Arbitrum
// are one adapter — same address format, same API, only the chainid differs.
import { ERC20_ALLOWLIST, getOutgoingTokenTransfers, getOutgoingTransactions } from "@/lib/etherscan";
import { traceChain } from "./bfs";
import type { TraceGraph } from "./types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const CHAIN_ID = { ETHEREUM: 1, POLYGON: 137, ARBITRUM: 42161 } as const;

function traceEvm(chain: keyof typeof CHAIN_ID, rootAddress: string, maxDepth: number): Promise<TraceGraph> {
  const chainId = CHAIN_ID[chain];
  return traceChain(
    {
      chain,
      normalize: (a) => a.toLowerCase(),
      fetchOutgoing: async (address) => {
        const [txs, tokenTxs] = await Promise.all([
          getOutgoingTransactions(address, chainId),
          getOutgoingTokenTransfers(address, chainId),
        ]);

        // A USDT send is *also* a zero-value tx into the USDT contract in
        // txlist, under the same hash. Keep both and every token transfer
        // draws twice: once to its real recipient, once as a phantom
        // contract-call edge to Tether (ROADMAP.md items 0 and 1). Only an
        // allowlisted transfer replaces its tx — any other token send keeps
        // its CONTRACT_CALL edge to the token contract, as before.
        //
        // The hash match alone isn't enough: txlist and tokentx are separate
        // 100-row windows, and on a busy receiver tokentx is half incoming,
        // so it reaches back less far. Measured on Polygon 0x10b692f5…: 78
        // transfer() calls into USDT0, only 44 with a tokentx row on the
        // page — the other 34 rendered as a phantom "34 contract calls" edge
        // into the USDT0 contract. So a zero-value tx *into* an allowlisted
        // token contract never becomes an edge either: its transfer is
        // either on the token page (drawn to the real recipient) or older
        // than it, and an approve() moves nothing.
        // ponytail: those older transfers are simply invisible, same as any
        // tx past either window. Page tokentx if that matters.
        const tokenHashes = new Set(tokenTxs.map((t) => t.hash));

        const native = txs
          .filter((tx) => {
            const to = tx.to?.toLowerCase();
            if (!to || to === ZERO_ADDRESS) return false; // skip burns/contract creation
            if (tx.value !== "0") return true;
            return !tokenHashes.has(tx.hash) && !ERC20_ALLOWLIST[chainId][to];
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
            asset: ERC20_ALLOWLIST[chainId][t.contractAddress.toLowerCase()],
          }));

        return { transfers: [...native, ...tokens] };
      },
    },
    rootAddress,
    maxDepth
  );
}

export const traceEthereum = (address: string, maxDepth: number) => traceEvm("ETHEREUM", address, maxDepth);
export const tracePolygon = (address: string, maxDepth: number) => traceEvm("POLYGON", address, maxDepth);
export const traceArbitrum = (address: string, maxDepth: number) => traceEvm("ARBITRUM", address, maxDepth);
