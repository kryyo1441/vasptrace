// LIVE: hits Blockstream's public Esplora API for Bitcoin. No API key needed.
const BLOCKSTREAM_BASE = "https://blockstream.info/api";

interface EsploraVout {
  scriptpubkey_address?: string;
  value: number;
}
interface EsploraVin {
  prevout?: { scriptpubkey_address?: string };
}
interface EsploraTx {
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

// ponytail: /address/:addr/txs returns only the ~25 most recent confirmed
// txs (plus mempool) — no pagination here. Good enough for a demo trace;
// use /txs/chain/:last_txid to page through full history if needed.
//
// ponytail: change-address heuristic is "any vout back to the same input
// address isn't a new hop" — real wallets often use a *fresh* change
// address, which this can't detect without full common-input-ownership
// clustering (that's what lib/clustering.ts's medium-confidence tier
// approximates downstream, not this fetch step).
export async function getOutgoingTransfers(address: string): Promise<BitcoinOutgoing[]> {
  const res = await fetch(`${BLOCKSTREAM_BASE}/address/${address}/txs`);
  if (!res.ok) {
    throw new Error(`Blockstream API request failed: ${res.status}`);
  }
  const txs: EsploraTx[] = await res.json();

  const out: BitcoinOutgoing[] = [];
  for (const tx of txs) {
    if (!tx.status.confirmed || !tx.status.block_time) continue;
    const isSender = tx.vin.some((v) => v.prevout?.scriptpubkey_address === address);
    if (!isSender) continue;
    for (const vout of tx.vout) {
      const to = vout.scriptpubkey_address;
      if (!to || to === address) continue; // no address (OP_RETURN) or change back to self
      out.push({ to, valueSats: String(vout.value), txHash: tx.txid, timestamp: tx.status.block_time });
    }
  }
  return out;
}
