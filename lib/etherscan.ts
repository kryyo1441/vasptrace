// LIVE: hits the real Etherscan v2 API. Requires ETHERSCAN_API_KEY.
import { withPacing } from "@/lib/rateLimit";
import type { TraceAsset } from "@/lib/tracers/types";

const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api";
const ETH_MAINNET_CHAIN_ID = 1;
const API_PACING_MS = 250;

export interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string; // wei, as a decimal string
  timeStamp: string; // unix seconds, as a string
  isError: string; // "0" success, "1" failed
}

export interface EtherscanTokenTx {
  hash: string;
  from: string;
  to: string;
  value: string; // token base units, as a decimal string
  timeStamp: string;
  contractAddress: string;
}

// Keyed by contract, never by symbol: tokentx also returns spam tokens that
// copy real names — the Binance demo address 0x1b821468… has a fake "E͏TH"
// (zero-width character inside) "sent" from it. Symbol and decimals are
// pinned here rather than read off the response. Both verified live
// 2026-09-13 against Etherscan's own tokenSymbol/tokenDecimal.
// ponytail: stablecoins only — the rails fraud proceeds actually move on.
// Add a contract here (verified the same way) to trace another token.
export const ERC20_ALLOWLIST: Record<string, TraceAsset> = {
  "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT", decimals: 6, contract: "0xdac17f958d2ee523a2206206994597c13d831ec7" },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", decimals: 6, contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
};

export async function getOutgoingTransactions(address: string): Promise<EtherscanTx[]> {
  const txs = await accountCall<EtherscanTx>("txlist", address);
  return txs.filter((tx) => tx.isError === "0" && tx.from.toLowerCase() === address.toLowerCase());
}

// Allowlisted ERC-20 transfers *from* this address. A Transfer event only
// exists for a successful transfer, so there's no isError to check. Zero-value
// ones are dropped: they move nothing, and a zero-value transferFrom is the
// standard address-poisoning trick (anyone can emit one "from" any address).
export async function getOutgoingTokenTransfers(address: string): Promise<EtherscanTokenTx[]> {
  const txs = await accountCall<EtherscanTokenTx>("tokentx", address);
  return txs.filter(
    (tx) =>
      tx.from.toLowerCase() === address.toLowerCase() &&
      ERC20_ALLOWLIST[tx.contractAddress.toLowerCase()] !== undefined &&
      tx.value !== "0"
  );
}

// ponytail: no retry/backoff on 429 — withPacing already serializes every
// call (single trace or concurrent traces) so at most one Etherscan request
// is ever in flight, which is what its free tier actually limits (verified
// live: simultaneous raw requests with the same key get "NOTOK", not just
// bursty ones). Add exponential backoff too if the API starts failing
// anyway.
async function accountCall<T>(action: "txlist" | "tokentx", address: string): Promise<T[]> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY is not set");

  const url = new URL(ETHERSCAN_BASE);
  url.searchParams.set("chainid", String(ETH_MAINNET_CHAIN_ID));
  url.searchParams.set("module", "account");
  url.searchParams.set("action", action);
  url.searchParams.set("address", address);
  url.searchParams.set("sort", "desc"); // most recent first
  url.searchParams.set("offset", "100"); // cap per-address fetch
  url.searchParams.set("page", "1");
  url.searchParams.set("apikey", apiKey);

  return withPacing("etherscan", API_PACING_MS, async () => {
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Etherscan API request failed: ${res.status}`);
    }

    const data = await res.json();

    // Etherscan returns status "0" both for "no transactions found" and for
    // real errors — message distinguishes them.
    if (data.status === "0") {
      if (data.message === "No transactions found") return [];
      throw new Error(`Etherscan API error: ${data.message ?? "unknown error"}`);
    }

    return data.result as T[];
  });
}
