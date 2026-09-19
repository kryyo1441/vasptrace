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

// Esplora pages confirmed history 25 txs at a time (/txs, then
// /txs/chain/:last_txid).
const PAGE_SIZE = 25;
// ponytail: pages further back only while a full page produced no outgoing
// transfer — the "busy receiver whose send is past the first 25 txs" case
// (DEMO_ADDRESSES.md's bc1qm34l… sweeper). An address that did send on page 1
// stops there, so ordinary traces cost exactly what they did. Older sends on
// an address that also sent recently are still invisible; raise MAX_PAGES
// (one paced call each) if that matters.
const MAX_PAGES = 3;

interface EsploraAddressStats {
  chain_stats: { funded_txo_sum: number; spent_txo_sum: number };
}

// Real, complete figures — Esplora indexes an address's entire confirmed
// history, so unlike Etherscan/Tronscan's current-balance-only limitation
// (see their own getNativeBalance/getAccountBalance), Bitcoin's
// totalReceivedBaseUnits is an honest lifetime total, not a windowed
// approximation. Mempool (unconfirmed) txs are excluded, consistent with the
// rest of this file only reading confirmed transactions.
export async function getAddressStats(address: string): Promise<{ balanceSats: string; totalReceivedSats: string }> {
  return withPacing("blockstream", API_PACING_MS, async () => {
    const res = await fetch(`${BLOCKSTREAM_BASE}/address/${address}`);
    if (!res.ok) throw new Error(`Blockstream API request failed: ${res.status}`);
    const stats = (await res.json()) as EsploraAddressStats;
    const funded = BigInt(stats.chain_stats.funded_txo_sum);
    const spent = BigInt(stats.chain_stats.spent_txo_sum);
    return { balanceSats: (funded - spent).toString(), totalReceivedSats: funded.toString() };
  });
}

// Change: a vout paying back to *any* input address of a non-CoinJoin tx is
// the same wallet paying itself (common-input ownership again), not a hop —
// it used to draw as one, and a 2-output payment+change then read as a
// PEEL_CHAIN. Fresh never-spent change addresses stay undetectable.
export async function getOutgoingTransfers(
  address: string
): Promise<{ outgoing: BitcoinOutgoing[]; coSpenders: Map<string, string> }> {
  const outgoing: BitcoinOutgoing[] = [];
  // Addresses that signed inputs alongside this one — same response, no
  // extra API call. Value is one txid as evidence.
  const coSpenders = new Map<string, string>();
  let lastTxid: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const txs = await withPacing("blockstream", API_PACING_MS, async () => {
      const res = await fetch(`${BLOCKSTREAM_BASE}/address/${address}/txs${lastTxid ? `/chain/${lastTxid}` : ""}`);
      if (!res.ok) {
        throw new Error(`Blockstream API request failed: ${res.status}`);
      }
      return (await res.json()) as EsploraTx[];
    });

    for (const tx of txs) {
      if (!tx.status.confirmed || !tx.status.block_time) continue;
      const inputs = inputAddresses(tx);
      if (!inputs.has(address)) continue;
      const coinJoin = isLikelyCoinJoin(tx);
      if (!coinJoin) {
        for (const peer of inputs) if (peer !== address && !coSpenders.has(peer)) coSpenders.set(peer, tx.txid);
      }
      for (const vout of tx.vout) {
        const to = vout.scriptpubkey_address;
        if (!to) continue; // no address (OP_RETURN)
        if (coinJoin ? to === address : inputs.has(to)) continue; // change
        outgoing.push({ to, valueSats: String(vout.value), txHash: tx.txid, timestamp: tx.status.block_time });
      }
    }

    const confirmed = txs.filter((t) => t.status.confirmed);
    if (outgoing.length > 0 || confirmed.length < PAGE_SIZE) break;
    lastTxid = confirmed[confirmed.length - 1].txid;
  }
  return { outgoing, coSpenders };
}

/** One Bitcoin transaction by txid (tx-hash intake, lib/txresolve.ts). Null on 404. */
export async function getTransaction(txid: string): Promise<EsploraTx | null> {
  return withPacing("blockstream", API_PACING_MS, async () => {
    const res = await fetch(`${BLOCKSTREAM_BASE}/tx/${txid}`);
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`Blockstream API request failed: ${res.status}`);
    return (await res.json()) as EsploraTx;
  });
}
