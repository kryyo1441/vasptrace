// Terror-financing labels (added 2026-09-18). PS 26182 asks for "alerting for
// high-risk wallets linked to ... terrorism financing". Two primary-source
// feeds, both machine-readable:
//
// - Israel's National Bureau for Counter Terror Financing (NBCTF) publishes
//   administrative seizure orders listing Hamas/Hezbollah/IRGC-linked wallets.
//   nbctf.mod.gov.il blocks scripts, so this reads OpenSanctions' mirror of it
//   (dataset il_mod_crypto), which carries each wallet's seizure-order number
//   and the NBCTF source PDF.
// - OFAC SDN entries under the SDGT (Specially Designated Global Terrorist)
//   program — already in the OFAC sync; lib/sanctions.ts's programs column
//   decides which label type they get (sanctionLabelType below).
import type { Chain, LabelType } from "@/lib/generated/prisma/client";
import { ADDRESS_VALIDATORS } from "@/lib/address";

export const NBCTF_URL = "https://data.opensanctions.org/datasets/latest/il_mod_crypto/targets.nested.json";

export interface TerrorAddress {
  address: string;
  chain: Chain;
  name: string;
  order: string;
}

interface NestedEntity {
  schema: string;
  properties: {
    publicKey?: string[];
    currency?: string[];
    holder?: { caption: string }[];
    sanctions?: { properties: { authorityId?: string[] } }[];
  };
}

// The listing names a currency at best (often not even that), never a chain,
// so the address format decides — the same approach as the OFAC parser.
// ponytail: a 0x address goes to ETHEREUM unless the listing says BNB; the
// same key controls it on every EVM chain, but a listing isn't stretched past
// what it names. Homoglyph entries (NBCTF lists some USDT addresses with
// Cyrillic look-alike letters, exactly as the scammers used them) fail the
// validators and are dropped — they can't appear on-chain anyway.
function chainFor(address: string, currency: string | undefined): Chain | null {
  if (ADDRESS_VALIDATORS.TRON.test(address)) return "TRON";
  if (ADDRESS_VALIDATORS.BITCOIN.test(address)) return "BITCOIN";
  if (ADDRESS_VALIDATORS.ETHEREUM.test(address)) return currency === "BNB" ? "BSC" : "ETHEREUM";
  return null;
}

// OpenSanctions' nested export is JSON Lines: one entity per line.
export function parseNbctfJsonl(jsonl: string): TerrorAddress[] {
  const found = new Map<string, TerrorAddress>();
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    let e: NestedEntity;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.schema !== "CryptoWallet") continue;
    const raw = e.properties.publicKey?.[0]?.trim();
    if (!raw) continue;
    const chain = chainFor(raw, e.properties.currency?.[0]);
    if (!chain) continue;
    const address = chain === "ETHEREUM" || chain === "BSC" ? raw.toLowerCase() : raw;
    const order = e.properties.sanctions?.[0]?.properties.authorityId?.[0] ?? "unnumbered order";
    const holder = e.properties.holder?.[0]?.caption;
    found.set(`${chain}|${address}`, {
      address,
      chain,
      order,
      name: `${holder ? `${holder} — ` : ""}NBCTF seizure order ${order}`,
    });
  }
  return [...found.values()];
}

// OFAC tags terrorism designations with the SDGT program code.
export function sanctionLabelType(programs: string): "SANCTIONED" | "TERROR_FINANCING" {
  return /\bSDGT\b/.test(programs) ? "TERROR_FINANCING" : "SANCTIONED";
}

// What an automated sync may do to an existing row. The SamSam rule
// (lib/sanctions.ts's sync route, 2026-09-14): a hand-curated label is never
// overwritten. Added here: TERROR_FINANCING is never downgraded to the
// generic SANCTIONED because a second feed also lists the address without a
// terrorism tag — the more specific finding wins, whichever feed ran last.
export function syncDecision(existing: LabelType | undefined, incoming: "SANCTIONED" | "TERROR_FINANCING"): "create" | "update" | "skip" {
  if (!existing) return "create";
  if (existing === "TERROR_FINANCING") return incoming === "TERROR_FINANCING" ? "update" : "skip";
  if (existing === "SANCTIONED") return "update";
  return "skip"; // hand-curated (EXCHANGE, RANSOMWARE, MIXER, ...)
}
