// LIVE: hits Blockstream's public Esplora API for Bitcoin. No API key needed.
import { withPacing } from "@/lib/rateLimit";

const BLOCKSTREAM_BASE = "https://blockstream.info/api";
const API_PACING_MS = 250;

interface EsploraVout {
  scriptpubkey_address?: string;
  value: number;
}
interface EsploraVin {
  prevout?: { scriptpubkey_address?: string } | null; // null on coinbase inputs
}
export interface EsploraTx {
  txid: string;
  vin: EsploraVin[];
  vout: EsploraVout[];
  status: { confirmed: boolean; block_time?: number };
}

export interface BitcoinOutgoing {
  to: string;
  valueSats: string;
  txHash: string;
  timestamp: number;
}

function inputAddresses(tx: EsploraTx): Set<string> {
  const out = new Set<string>();
  for (const v of tx.vin) if (v.prevout?.scriptpubkey_address) out.add(v.prevout.scriptpubkey_address);
  return out;
}

// A CoinJoin deliberately merges unrelated wallets' inputs into one tx, so
// common-input ownership (lib/clustering.ts) must not read its inputs as one
// owner — one CoinJoin could otherwise attribute a suspect to an exchange
// that merely shared the tx, and that attribution reaches the disclosure
// draft. Shape check: several input owners, and several outputs of one
// identical value (the mixed denomination).
// ponytail: naive shape rule. Catches Wasabi/Whirlpool/JoinMarket-style equal
// outputs; misses PayJoin, which is built to look like an ordinary payment,
// and skips the odd exchange batch payout that pays two users the same
// amount (a missed attribution, never a false one). Upgrade: a proper
// CoinJoin classifier (e.g. per-coordinator fingerprints).
export function isLikelyCoinJoin(tx: EsploraTx): boolean {
  if (inputAddresses(tx).size < 2 || tx.vout.length < 3) return false;
  const seen = new Set<number>();
  for (const o of tx.vout) {
    if (seen.has(o.value)) return true;
    seen.add(o.value);
  }
  return false;
}

// ponytail: /address/:addr/txs returns only the ~25 most recent confirmed
// txs (plus mempool) — no pagination here. Good enough for a demo trace;
// use /txs/chain/:last_txid to page through full history if needed.
//
// ponytail: change-address heuristic is "any vout back to the same input
// address isn't a new hop". A vout to one of `coSpenders` is almost
// certainly change too, but still draws as a hop — dropping it would change
// PEEL_CHAIN output on the 2-output txs that flag relies on, a separate call
// from attribution. Fresh never-spent change addresses stay undetectable.
export async function getOutgoingTransfers(
  address: string
): Promise<{ outgoing: BitcoinOutgoing[]; coSpenders: Map<string, string> }> {
  return withPacing("blockstream", API_PACING_MS, async () => {
    const res = await fetch(`${BLOCKSTREAM_BASE}/address/${address}/txs`);
    if (!res.ok) {
      throw new Error(`Blockstream API request failed: ${res.status}`);
    }
    const txs: EsploraTx[] = await res.json();

    const outgoing: BitcoinOutgoing[] = [];
    // Addresses that signed inputs alongside this one — same response, no
    // extra API call. Value is one txid as evidence.
    const coSpenders = new Map<string, string>();
    for (const tx of txs) {
      if (!tx.status.confirmed || !tx.status.block_time) continue;
      const inputs = inputAddresses(tx);
      if (!inputs.has(address)) continue;
      if (!isLikelyCoinJoin(tx)) {
        for (const peer of inputs) if (peer !== address && !coSpenders.has(peer)) coSpenders.set(peer, tx.txid);
      }
      for (const vout of tx.vout) {
        const to = vout.scriptpubkey_address;
        if (!to || to === address) continue; // no address (OP_RETURN) or change back to self
        outgoing.push({ to, valueSats: String(vout.value), txHash: tx.txid, timestamp: tx.status.block_time });
      }
    }
    return { outgoing, coSpenders };
  });
}
