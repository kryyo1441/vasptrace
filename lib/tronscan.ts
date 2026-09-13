// LIVE: hits Tronscan's public API for Tron. Works keyless at demo volume;
// set TRONSCAN_API_KEY (sent as TRON-PRO-API-KEY) if rate limits bite.
import { withPacing } from "@/lib/rateLimit";
import type { TraceAsset } from "@/lib/tracers/types";

const TRONSCAN_BASE = "https://apilist.tronscanapi.com/api/transaction";
const TRC20_TRANSFERS_BASE = "https://apilist.tronscanapi.com/api/filter/trc20/transfers";
const API_PACING_MS = 250;

// contractType 1 = native TRX TransferContract. TRC20/USDT transfers are a
// different contractType (31, TriggerSmartContract), so this filter never
// sees them — they come from getOutgoingUsdtTransfers below instead, and
// unlike Ethereum's txlist there's no zero-value phantom tx to de-duplicate.
const NATIVE_TRANSFER_CONTRACT_TYPE = 1;

// Pinned here, not read off the response (spam TRC20s copy real symbols).
// Verified live 2026-09-13: Tronscan's own tokenInfo says USDT, 6 decimals.
export const TRC20_USDT: TraceAsset = { symbol: "USDT", decimals: 6, contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" };

interface TronscanTx {
  hash: string;
  ownerAddress: string;
  toAddress?: string;
  contractType: number;
  contractRet: string;
  amount: string;
  timestamp: number; // milliseconds
}

interface Trc20Transfer {
  transaction_id: string;
  from_address: string;
  to_address?: string;
  quant: string; // token base units
  contractRet: string;
  block_ts: number; // milliseconds
}

export interface TronOutgoing {
  to: string;
  valueBaseUnits: string; // sun, or the asset's base units when `asset` is set
  txHash: string;
  timestamp: number;
  asset?: TraceAsset;
}

function headers() {
  const h: Record<string, string> = {};
  const apiKey = process.env.TRONSCAN_API_KEY;
  if (apiKey) h["TRON-PRO-API-KEY"] = apiKey;
  return h;
}

// ponytail: no retry/backoff on 429 — mirrors the Ethereum tracer's
// tradeoff. Add exponential backoff if hop counts grow past a demo trace.
export async function getOutgoingTransfers(address: string): Promise<TronOutgoing[]> {
  const url = new URL(TRONSCAN_BASE);
  url.searchParams.set("sort", "-timestamp");
  url.searchParams.set("count", "true");
  url.searchParams.set("limit", "50");
  url.searchParams.set("start", "0");
  url.searchParams.set("address", address);

  return withPacing("tronscan", API_PACING_MS, async () => {
    const res = await fetch(url.toString(), { headers: headers() });
    if (!res.ok) {
      throw new Error(`Tronscan API request failed: ${res.status}`);
    }
    const data = await res.json();

    return (data.data as TronscanTx[])
      .filter(
        (tx) =>
          tx.contractType === NATIVE_TRANSFER_CONTRACT_TYPE &&
          tx.contractRet === "SUCCESS" &&
          tx.ownerAddress === address &&
          tx.toAddress &&
          tx.toAddress !== address
      )
      .map((tx) => ({
        to: tx.toAddress!,
        valueBaseUnits: String(tx.amount ?? "0"),
        txHash: tx.hash,
        timestamp: Math.floor(tx.timestamp / 1000), // ms -> unix seconds
      }));
  });
}

// USDT-TRC20 transfers from this address. Filtered to the USDT contract
// server-side (`contract_address` — verified 2026-09-13, 50 of 50 rows came
// back USDT) so spam tokens can't crowd real transfers out of the page.
// Direction is filtered here: `fromAddress` would do it server-side, but
// keyless it 301s to an endpoint that answers 401.
// ponytail: one page of 50 rows in *both* directions, so a busy receiver's
// outgoing sends can fall off it. Paginate with `start` if that bites.
export async function getOutgoingUsdtTransfers(address: string): Promise<TronOutgoing[]> {
  const url = new URL(TRC20_TRANSFERS_BASE);
  url.searchParams.set("sort", "-timestamp");
  url.searchParams.set("limit", "50");
  url.searchParams.set("start", "0");
  url.searchParams.set("relatedAddress", address);
  url.searchParams.set("contract_address", TRC20_USDT.contract);

  return withPacing("tronscan", API_PACING_MS, async () => {
    const res = await fetch(url.toString(), { headers: headers() });
    if (!res.ok) {
      throw new Error(`Tronscan TRC20 request failed: ${res.status}`);
    }
    const data = await res.json();

    return ((data.token_transfers ?? []) as Trc20Transfer[])
      .filter(
        (t) =>
          t.from_address === address &&
          t.contractRet === "SUCCESS" &&
          t.to_address &&
          t.to_address !== address &&
          t.quant !== "0"
      )
      .map((t) => ({
        to: t.to_address!,
        valueBaseUnits: t.quant,
        txHash: t.transaction_id,
        timestamp: Math.floor(t.block_ts / 1000),
        asset: TRC20_USDT,
      }));
  });
}
