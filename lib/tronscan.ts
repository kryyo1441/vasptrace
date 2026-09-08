// LIVE: hits Tronscan's public API for Tron. Works keyless at demo volume;
// set TRONSCAN_API_KEY (sent as TRON-PRO-API-KEY) if rate limits bite.
import { withPacing } from "@/lib/rateLimit";

const TRONSCAN_BASE = "https://apilist.tronscanapi.com/api/transaction";
const API_PACING_MS = 250;

// contractType 1 = native TRX TransferContract. Traced the same way the
// Ethereum tracer traces native ETH (not ERC20) — TRC20/USDT transfers are
// a different contractType (31, TriggerSmartContract) with the amount
// encoded in contractData instead of the top-level `amount` field; out of
// scope for this pass, same "native transfers only" parity as Ethereum.
const NATIVE_TRANSFER_CONTRACT_TYPE = 1;

interface TronscanTx {
  hash: string;
  ownerAddress: string;
  toAddress?: string;
  contractType: number;
  contractRet: string;
  amount: string;
  timestamp: number; // milliseconds
}

export interface TronOutgoing {
  to: string;
  valueSun: string;
  txHash: string;
  timestamp: number;
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

  const headers: Record<string, string> = {};
  const apiKey = process.env.TRONSCAN_API_KEY;
  if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;

  return withPacing("tronscan", API_PACING_MS, async () => {
    const res = await fetch(url.toString(), { headers });
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
        valueSun: String(tx.amount ?? "0"),
        txHash: tx.hash,
        timestamp: Math.floor(tx.timestamp / 1000), // ms -> unix seconds
      }));
  });
}
