// LIVE: Solana via public JSON-RPC (added 2026-09-18). Solana is named in PS
// 26182. The public mainnet endpoint needs no key; set SOLANA_RPC_URL to a
// provider endpoint (Helius, QuickNode, ...) if its rate limits bite.
//
// Shape difference that matters: Solana has no "transactions from this
// address with value" endpoint. getSignaturesForAddress returns signatures
// only, so every transaction costs a second getTransaction call — N+1 per
// address. That makes Solana the most expensive chain in this app per hop;
// SIGNATURE_LIMIT below is the lever.
import { withPacing } from "@/lib/rateLimit";
import type { TraceAsset } from "@/lib/tracers/types";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
// The public endpoint documents ~40 calls per method per 10s per IP, but
// answered 429 at ~3 calls/s when measured (2026-09-18) — so 500ms pacing,
// plus a bounded backoff on 429 below.
const API_PACING_MS = 500;
const MAX_RETRIES = 4;
// ponytail: only the 15 most recent transactions per address are read (each
// one is its own call). Older sends are invisible, same class of limit as
// Blockstream's 25-tx window. Raise with a paid RPC.
const SIGNATURE_LIMIT = 15;

// SPL mints, pinned (never read symbol/decimals off the chain — same
// spam-token rule as the EVM allowlist). Both are the issuers' canonical
// mints, 6 decimals.
export const SPL_ALLOWLIST: Record<string, TraceAsset> = {
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: "USDT", decimals: 6, contract: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", decimals: 6, contract: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
};

interface ParsedInstruction {
  program?: string;
  parsed?: { type?: string; info?: Record<string, unknown> };
}

export interface SolanaParsedTx {
  blockTime: number | null;
  meta: {
    err: unknown;
    innerInstructions?: { instructions: ParsedInstruction[] }[];
    postTokenBalances?: { accountIndex: number; mint: string; owner?: string }[];
    preTokenBalances?: { accountIndex: number; mint: string; owner?: string }[];
  } | null;
  transaction: {
    signatures: string[];
    message: { accountKeys: { pubkey: string; signer: boolean }[]; instructions: ParsedInstruction[] };
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  return withPacing("solana", API_PACING_MS, async () => {
    let res: Response;
    // Retried inside the pacing slot on purpose: the whole queue waits out a
    // 429 rather than the next queued call walking straight into it.
    for (let attempt = 0; ; attempt++) {
      res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (res.status !== 429 || attempt >= MAX_RETRIES) break;
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
    }
    if (!res.ok) throw new Error(`Solana RPC ${method} failed: HTTP ${res.status}`);
    const json = await res.json();
    // JSON-RPC errors arrive with HTTP 200 — unchecked, a rate-limit error
    // would read as "no transactions", i.e. a clean trace that found nothing.
    if (json.error) throw new Error(`Solana RPC ${method} failed: ${json.error.message ?? "unknown error"}`);
    return json.result as T;
  });
}

export function getSolanaTransaction(signature: string): Promise<SolanaParsedTx | null> {
  return rpc<SolanaParsedTx | null>("getTransaction", [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
}

export interface SolanaTransfer {
  to: string;
  valueBaseUnits: string;
  asset?: TraceAsset;
}

// Value-moving instructions *from* `address` in one parsed transaction:
// native SOL (system transfer) and allowlisted SPL tokens. An SPL transfer
// names token *accounts*, not wallets — the destination wallet is the token
// account's owner, read from the tx's own token-balance metadata (no extra
// call). Inner instructions are included: swaps and batch payouts put their
// transfers there.
export function solanaTransfersFrom(tx: SolanaParsedTx, address: string): SolanaTransfer[] {
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey);
  const tokenInfo = new Map<string, { mint: string; owner?: string }>();
  for (const b of [...(tx.meta?.preTokenBalances ?? []), ...(tx.meta?.postTokenBalances ?? [])]) {
    tokenInfo.set(keys[b.accountIndex], { mint: b.mint, owner: b.owner });
  }
  const all = [
    ...tx.transaction.message.instructions,
    ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions),
  ];

  const out: SolanaTransfer[] = [];
  for (const ix of all) {
    const type = ix.parsed?.type;
    const info = ix.parsed?.info ?? {};
    if (ix.program === "system" && (type === "transfer" || type === "transferWithSeed")) {
      if (info.source !== address || !info.destination) continue;
      const lamports = String(info.lamports ?? "0");
      if (lamports !== "0") out.push({ to: String(info.destination), valueBaseUnits: lamports });
    } else if ((ix.program === "spl-token" || ix.program === "spl-token-2022") && (type === "transfer" || type === "transferChecked")) {
      if (info.authority !== address && info.multisigAuthority !== address) continue;
      const dest = tokenInfo.get(String(info.destination));
      const mint = (info.mint as string | undefined) ?? dest?.mint ?? tokenInfo.get(String(info.source))?.mint;
      const asset = mint ? SPL_ALLOWLIST[mint] : undefined;
      if (!asset || !dest?.owner) continue; // not an allowlisted token, or owner unknown
      const amount = String((info.tokenAmount as { amount?: string } | undefined)?.amount ?? info.amount ?? "0");
      if (amount !== "0" && dest.owner !== address) out.push({ to: dest.owner, valueBaseUnits: amount, asset });
    }
  }
  return out;
}

export async function getOutgoingSolana(address: string): Promise<{ to: string; valueBaseUnits: string; txHash: string; timestamp: number; asset?: TraceAsset }[]> {
  const sigs = await rpc<{ signature: string; err: unknown; blockTime: number | null }[]>("getSignaturesForAddress", [
    address,
    { limit: SIGNATURE_LIMIT },
  ]);
  const out = [];
  for (const s of sigs) {
    if (s.err) continue; // failed tx moved nothing
    const tx = await getSolanaTransaction(s.signature);
    if (!tx || tx.meta?.err) continue;
    for (const t of solanaTransfersFrom(tx, address)) {
      out.push({ ...t, txHash: s.signature, timestamp: tx.blockTime ?? s.blockTime ?? 0 });
    }
  }
  return out;
}

/** Native SOL balance in lamports, as a decimal string. */
export async function getSolBalance(address: string): Promise<string> {
  const result = await rpc<{ value: number }>("getBalance", [address]);
  return String(result.value);
}
