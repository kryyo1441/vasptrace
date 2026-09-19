// LIVE: BNB Chain data via Ankr's Advanced API. Every other EVM chain in this
// app goes through Etherscan v2, but Etherscan's free tier refuses chainid 56
// outright ("Free API access is not supported for this chain" — verified
// 2026-09-13 and again 2026-09-16), and the alternatives were checked too:
// legacy api.bscscan.com is deprecated and redirects to v2, Routescan answers
// "chain not supported" for 56, and there is no public Blockscout instance for
// BSC. Ankr's free tier does serve it, so BNB Chain gets its own client.
//
// Shape difference that matters: Ankr is JSON-RPC over POST, returns *both*
// directions of transfers in one call, and reports value/timestamp as hex —
// none of which is true of Etherscan. That is why this isn't a chainid added
// to lib/etherscan.ts.
import { withPacing } from "@/lib/rateLimit";

const ANKR_MULTICHAIN = "https://rpc.ankr.com/multichain";
// Same reasoning as the Etherscan client: one in-flight request per provider,
// process-wide, because free tiers rate-limit on concurrency, not rate.
const API_PACING_MS = 250;
const PAGE_SIZE = 100;

export interface AnkrTransaction {
  from: string;
  to: string | null;
  hash: string;
  value: string; // hex wei
  timestamp: string; // hex unix seconds
  status: string;
}

function requireToken(): string {
  const token = process.env.ANKR_API_KEY;
  if (!token) {
    throw new Error(
      "BNB Chain tracing needs ANKR_API_KEY (free key from ankr.com) — every other chain works without it."
    );
  }
  return token;
}

async function rpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const token = requireToken();
  return withPacing("ankr", API_PACING_MS, async () => {
    const res = await fetch(`${ANKR_MULTICHAIN}/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
    });
    if (!res.ok) throw new Error(`Ankr ${method} failed: HTTP ${res.status}`);
    const json = await res.json();
    // JSON-RPC reports failure in the body with HTTP 200 — a missing check
    // here would surface an auth or quota failure as "no transactions",
    // i.e. as a clean trace that found nothing.
    if (json.error) throw new Error(`Ankr ${method} failed: ${json.error.message ?? "unknown error"}`);
    return json.result as T;
  });
}

// Hex → decimal string. Values are wei-scale, so they must not touch Number.
export function hexToDecimalString(hex: string | undefined): string {
  if (!hex) return "0";
  return BigInt(hex).toString();
}

/**
 * Outgoing BNB transfers for one address. Ankr returns both directions, so the
 * caller's `from` filter is what makes this outgoing-only.
 */
export async function getBscTransactions(address: string): Promise<AnkrTransaction[]> {
  const result = await rpc<{ transactions?: AnkrTransaction[] }>("ankr_getTransactionsByAddress", {
    blockchain: "bsc",
    address,
    descOrder: true,
    pageSize: PAGE_SIZE,
  });
  return result?.transactions ?? [];
}

export interface AnkrAsset {
  tokenType?: string;
  tokenSymbol?: string;
  contractAddress?: string | null;
  balanceRawInteger?: string;
}

// Ankr's docs confirm the `assets` array and `tokenType`/`balanceRawInteger`
// field names but not the exact string a native-coin entry uses for
// tokenType (a "NATIVE" value is recalled from an unrelated example, not
// verified against this endpoint — see docs/PROGRESS.md's 2026-09-16 BSC
// entry). Rather than bet on one unverified string and silently return "0"
// (a wrong balance with no error, in a tool whose whole premise is not doing
// that), this tries every plausible shape in order and only gives up after
// all three miss.
export function pickNativeAsset(assets: AnkrAsset[], nativeSymbol: string): AnkrAsset | undefined {
  return (
    assets.find((a) => a.tokenType === "NATIVE") ??
    assets.find((a) => !a.contractAddress) ??
    assets.find((a) => a.tokenSymbol === nativeSymbol)
  );
}

/** Native BNB balance in wei, as a decimal string. */
export async function getBscNativeBalance(address: string): Promise<string> {
  const result = await rpc<{ assets?: AnkrAsset[] }>("ankr_getAccountBalance", {
    blockchain: "bsc",
    walletAddress: address,
    onlyWhitelisted: false,
  });
  const native = pickNativeAsset(result?.assets ?? [], "BNB");
  return native?.balanceRawInteger ?? "0";
}

/** One BNB Chain transaction by hash (tx-hash intake, lib/txresolve.ts). */
export async function getBscTransactionByHash(hash: string): Promise<AnkrTransaction | null> {
  const result = await rpc<{ transactions?: AnkrTransaction[] }>("ankr_getTransactionsByHash", {
    blockchain: "bsc",
    transactionHash: hash,
  });
  return result?.transactions?.[0] ?? null;
}
