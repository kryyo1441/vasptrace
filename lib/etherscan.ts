// LIVE: hits the real Etherscan v2 API. Requires ETHERSCAN_API_KEY.
import { withPacing } from "@/lib/rateLimit";

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

// ponytail: no retry/backoff on 429 — withPacing already serializes every
// call (single trace or concurrent traces) so at most one Etherscan request
// is ever in flight, which is what its free tier actually limits (verified
// live: simultaneous raw requests with the same key get "NOTOK", not just
// bursty ones). Add exponential backoff too if the API starts failing
// anyway.
export async function getOutgoingTransactions(address: string): Promise<EtherscanTx[]> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY is not set");

  const url = new URL(ETHERSCAN_BASE);
  url.searchParams.set("chainid", String(ETH_MAINNET_CHAIN_ID));
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "txlist");
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

    return (data.result as EtherscanTx[]).filter(
      (tx) => tx.isError === "0" && tx.from.toLowerCase() === address.toLowerCase()
    );
  });
}
