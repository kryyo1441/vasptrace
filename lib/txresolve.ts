// Transaction-hash intake (added 2026-09-18). A victim's complaint usually
// carries the transaction they sent — a hash off their wallet or exchange
// receipt — not the scammer's address. This turns that hash into the
// address(es) it paid, so the investigator can trace from there.
//
// Returns *candidates*, never a silent pick: a Bitcoin payment has several
// outputs (one of them may be change, which heuristics can't always tell
// apart), and a contract call can emit several token transfers. The caller
// auto-proceeds only when there is exactly one.
import { ERC20_ALLOWLIST, proxyCall } from "@/lib/etherscan";
import { getTransaction as getBtcTransaction, type EsploraTx } from "@/lib/blockstream";
import { getTransactionInfo, TRC20_USDT, type TronTxInfo } from "@/lib/tronscan";
import { getBscTransactionByHash, hexToDecimalString, type AnkrTransaction } from "@/lib/ankr";
import { getSolanaTransaction, solanaTransfersFrom, type SolanaParsedTx } from "@/lib/solana";
import type { Chain } from "@/lib/generated/prisma/client";
import type { TraceAsset } from "@/lib/tracers/types";

export interface TxRecipient {
  from: string;
  address: string;
  valueBaseUnits: string;
  asset?: TraceAsset; // absent = native
}

// Trust-boundary shape checks, one per chain family. EVM hashes carry 0x;
// Bitcoin txids and Tron hashes are bare 64-hex (so the selector decides
// between those two); Solana signatures are base58, 64 bytes → 86–88 chars.
const EVM_TX = /^0x[0-9a-fA-F]{64}$/;
const HEX64 = /^[0-9a-fA-F]{64}$/;
export const TX_HASH_VALIDATORS: Record<Chain, RegExp> = {
  ETHEREUM: EVM_TX,
  POLYGON: EVM_TX,
  ARBITRUM: EVM_TX,
  BSC: EVM_TX,
  BITCOIN: HEX64,
  TRON: HEX64,
  SOLANA: /^[1-9A-HJ-NP-Za-km-z]{86,88}$/,
};

export function isTxHash(value: string, chain: Chain): boolean {
  return TX_HASH_VALIDATORS[chain].test(value.trim());
}

// ERC-20 Transfer(address,address,uint256)
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

interface EvmTx {
  from: string;
  to: string | null;
  value: string; // hex wei
}
interface EvmReceipt {
  status?: string;
  logs: { address: string; topics: string[]; data: string }[];
}

const topicToAddress = (topic: string) => `0x${topic.slice(-40)}`.toLowerCase();

export function recipientsFromEvm(tx: EvmTx, receipt: EvmReceipt | null, chainId: number): TxRecipient[] {
  if (receipt?.status === "0x0") return []; // reverted: nothing moved
  const out: TxRecipient[] = [];
  const native = BigInt(tx.value || "0x0");
  if (tx.to && native > BigInt(0)) {
    out.push({ from: tx.from.toLowerCase(), address: tx.to.toLowerCase(), valueBaseUnits: native.toString() });
  }
  // Only allowlisted stablecoins — the same spam-token rule the tracer uses
  // (a fake "USDT" contract emits Transfer events too).
  for (const log of receipt?.logs ?? []) {
    const asset = ERC20_ALLOWLIST[chainId]?.[log.address.toLowerCase()];
    if (!asset || log.topics[0] !== TRANSFER_TOPIC || log.topics.length < 3) continue;
    const value = BigInt(log.data === "0x" ? "0x0" : log.data);
    if (value === BigInt(0)) continue; // zero-value Transfer = address poisoning
    out.push({ from: topicToAddress(log.topics[1]), address: topicToAddress(log.topics[2]), valueBaseUnits: value.toString(), asset });
  }
  return out;
}

// Every output that doesn't pay back to an input address (change). Fresh
// change addresses can't be told apart, hence candidates, not one answer.
export function recipientsFromBitcoin(tx: EsploraTx): TxRecipient[] {
  const inputs = new Set(tx.vin.map((v) => v.prevout?.scriptpubkey_address).filter((a): a is string => !!a));
  const from = [...inputs][0] ?? "";
  return tx.vout
    .filter((o) => o.scriptpubkey_address && !inputs.has(o.scriptpubkey_address) && o.value > 0)
    .map((o) => ({ from, address: o.scriptpubkey_address!, valueBaseUnits: String(o.value) }));
}

export function recipientsFromTron(info: TronTxInfo): TxRecipient[] {
  if (info.contractRet !== "SUCCESS") return [];
  const out: TxRecipient[] = [];
  if (info.contractType === 1 && info.toAddress && info.ownerAddress && (info.contractData?.amount ?? 0) > 0) {
    out.push({ from: info.ownerAddress, address: info.toAddress, valueBaseUnits: String(info.contractData!.amount) });
  }
  for (const t of info.trc20TransferInfo ?? []) {
    if (t.contract_address !== TRC20_USDT.contract || t.amount_str === "0") continue;
    out.push({ from: t.from_address, address: t.to_address, valueBaseUnits: t.amount_str, asset: TRC20_USDT });
  }
  return out;
}

export function recipientsFromBsc(tx: AnkrTransaction): TxRecipient[] {
  const value = BigInt(hexToDecimalString(tx.value));
  if (!tx.to || value === BigInt(0) || tx.status === "0x0") return [];
  return [{ from: tx.from.toLowerCase(), address: tx.to.toLowerCase(), valueBaseUnits: value.toString() }];
}

export function recipientsFromSolana(tx: SolanaParsedTx): TxRecipient[] {
  if (tx.meta?.err) return [];
  const signer = tx.transaction.message.accountKeys.find((k) => k.signer)?.pubkey;
  if (!signer) return [];
  return solanaTransfersFrom(tx, signer).map((t) => ({ from: signer, address: t.to, valueBaseUnits: t.valueBaseUnits, asset: t.asset }));
}

const EVM_CHAIN_ID = { ETHEREUM: 1, POLYGON: 137, ARBITRUM: 42161 } as const;

// LIVE: one or two paced explorer calls. Throws on API failure (the caller
// shows it); returns [] when the hash exists but moved nothing traceable.
// Returns null when the chain's explorer has no such transaction.
export async function resolveTxRecipients(hash: string, chain: Chain): Promise<TxRecipient[] | null> {
  const h = hash.trim();
  switch (chain) {
    case "ETHEREUM":
    case "POLYGON":
    case "ARBITRUM": {
      const id = EVM_CHAIN_ID[chain];
      const tx = await proxyCall<EvmTx>(id, "eth_getTransactionByHash", h);
      if (!tx) return null;
      const receipt = await proxyCall<EvmReceipt>(id, "eth_getTransactionReceipt", h);
      return recipientsFromEvm(tx, receipt, id);
    }
    case "BSC": {
      const tx = await getBscTransactionByHash(h);
      return tx ? recipientsFromBsc(tx) : null;
    }
    case "BITCOIN": {
      const tx = await getBtcTransaction(h.toLowerCase());
      return tx ? recipientsFromBitcoin(tx) : null;
    }
    case "TRON": {
      const info = await getTransactionInfo(h.toLowerCase());
      return info ? recipientsFromTron(info) : null;
    }
    case "SOLANA": {
      const tx = await getSolanaTransaction(h);
      return tx ? recipientsFromSolana(tx) : null;
    }
  }
}
