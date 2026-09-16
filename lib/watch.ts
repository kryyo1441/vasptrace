// Address monitoring (ROADMAP item 6). Deliberately no in-app worker/queue —
// ROADMAP.md is explicit that a real scheduler is an architecture change,
// not this feature's job. checkWatch is one address's worth of work; call it
// from a session-triggered "check now" or an external cron/n8n POST.
import { getOutgoingTokenTransfers, getOutgoingTransactions, ERC20_ALLOWLIST } from "@/lib/etherscan";
import { getOutgoingTransfers as getBtcOutgoing } from "@/lib/blockstream";
import { getOutgoingTransfers as getTrxOutgoing, getOutgoingUsdtTransfers } from "@/lib/tronscan";
import { getBscTransactions, hexToDecimalString } from "@/lib/ankr";
import { prisma } from "@/lib/prisma";
import type { Chain, Watch } from "@/lib/generated/prisma/client";

const EVM_CHAIN_ID: Partial<Record<Chain, number>> = { ETHEREUM: 1, POLYGON: 137, ARBITRUM: 42161 };
// BSC is EVM-shaped (hex, case-insensitive) but goes through Ankr, not
// Etherscan, so it can't just join EVM_CHAIN_ID above — kept as its own set
// for the case-folding check below.
const HEX_ADDRESS_CHAINS: ReadonlySet<Chain> = new Set([...Object.keys(EVM_CHAIN_ID), "BSC"] as Chain[]);

interface Seen {
  to: string;
  valueBaseUnits: string;
  txHash: string;
  timestamp: number;
  assetSymbol?: string;
}

async function fetchOutgoing(chain: Chain, address: string): Promise<Seen[]> {
  const chainId = EVM_CHAIN_ID[chain];
  if (chainId !== undefined) {
    const [txs, tokenTxs] = await Promise.all([
      getOutgoingTransactions(address, chainId),
      getOutgoingTokenTransfers(address, chainId),
    ]);
    const native = txs
      .filter((t) => t.value !== "0")
      .map((t) => ({ to: t.to, valueBaseUnits: t.value, txHash: t.hash, timestamp: Number(t.timeStamp) }));
    const tokens = tokenTxs.map((t) => ({
      to: t.to,
      valueBaseUnits: t.value,
      txHash: t.hash,
      timestamp: Number(t.timeStamp),
      assetSymbol: ERC20_ALLOWLIST[chainId][t.contractAddress.toLowerCase()]?.symbol,
    }));
    return [...native, ...tokens];
  }
  if (chain === "BITCOIN") {
    const { outgoing } = await getBtcOutgoing(address);
    return outgoing.map((o) => ({ to: o.to, valueBaseUnits: o.valueSats, txHash: o.txHash, timestamp: o.timestamp }));
  }
  if (chain === "BSC") {
    const from = address.toLowerCase();
    const txs = await getBscTransactions(address);
    return txs
      .filter((t) => t.from?.toLowerCase() === from && t.to)
      .map((t) => ({
        to: t.to as string,
        valueBaseUnits: hexToDecimalString(t.value),
        txHash: t.hash,
        timestamp: Number(BigInt(t.timestamp || "0x0")),
      }));
  }
  // TRON
  const [native, usdt] = await Promise.all([getTrxOutgoing(address), getOutgoingUsdtTransfers(address)]);
  return [
    ...native.map((t) => ({ to: t.to, valueBaseUnits: t.valueBaseUnits, txHash: t.txHash, timestamp: t.timestamp })),
    ...usdt.map((t) => ({ to: t.to, valueBaseUnits: t.valueBaseUnits, txHash: t.txHash, timestamp: t.timestamp, assetSymbol: t.asset?.symbol })),
  ];
}

function normalize(chain: Chain, address: string) {
  return HEX_ADDRESS_CHAINS.has(chain) ? address.toLowerCase() : address;
}

// Returns the number of new outgoing transfers found since the watch's last
// check (0 on a quiet address — not an error). Advances lastSeenTimestamp
// even when nothing new is found, so a watch never re-scans its own history.
export async function checkWatch(watch: Watch): Promise<number> {
  const [transfers, labels] = await Promise.all([
    fetchOutgoing(watch.chain, watch.address),
    prisma.labeledAddress.findMany({ where: { chain: watch.chain } }),
  ]);
  const labelByAddress = new Map(labels.map((l) => [normalize(watch.chain, l.address), l]));

  const since = watch.lastSeenTimestamp ?? 0;
  const fresh = transfers.filter((t) => t.timestamp > since);

  for (const t of fresh) {
    const label = labelByAddress.get(normalize(watch.chain, t.to));
    await prisma.watchAlert.upsert({
      where: {
        watchId_txHash_toAddress_assetSymbol: {
          watchId: watch.id,
          txHash: t.txHash,
          toAddress: t.to,
          assetSymbol: t.assetSymbol ?? "",
        },
      },
      update: {},
      create: {
        watchId: watch.id,
        txHash: t.txHash,
        toAddress: t.to,
        valueBaseUnits: t.valueBaseUnits,
        assetSymbol: t.assetSymbol ?? "",
        entityName: label?.entityName,
        labelType: label?.labelType,
        txTimestamp: t.timestamp,
      },
    });
  }

  const maxSeen = transfers.reduce((m, t) => Math.max(m, t.timestamp), since);
  await prisma.watch.update({
    where: { id: watch.id },
    data: { lastSeenTimestamp: maxSeen, lastCheckedAt: new Date() },
  });

  return fresh.length;
}
