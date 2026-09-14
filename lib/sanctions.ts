// Live OFAC SDN sync (ROADMAP item 5). OFAC itself is the primary source, so
// this meets prisma/seed.ts's "verified before labeling" bar by construction.
import type { Chain } from "@/lib/generated/prisma/client";
import { ADDRESS_VALIDATORS } from "@/lib/address";

export const SDN_CSV_URL = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV";

export interface SdnAddress {
  address: string;
  chain: Chain;
  name: string;
  programs: string;
}

// SDN.CSV has no header. Columns: ent_num, name, type, programs, title,
// call_sign, vess_type, tonnage, grt, vess_flag, vess_owner, remarks. Crypto
// addresses live in remarks as "Digital Currency Address - XBT 1abc…".
// Only chains this tool traces are kept; the currency code picks the chain,
// and the address format has to agree (USDT/USDC are listed under one code
// for every chain they run on, so the format decides between ETH and TRON).
// ponytail: ETH-listed addresses are labeled on ETHEREUM only, though the
// same key controls that address on Polygon/Arbitrum — OFAC lists a currency,
// not every chain, and this doesn't stretch the listing further than it goes.
const CODE_CHAINS: Record<string, Chain[]> = {
  XBT: ["BITCOIN"],
  ETH: ["ETHEREUM"],
  TRX: ["TRON"],
  USDT: ["ETHEREUM", "TRON"],
  USDC: ["ETHEREUM", "TRON"],
};

// Minimal RFC-4180 row splitter: fields are comma-separated, optionally
// double-quoted with "" as an escaped quote. SDN rows never span lines.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') field += line[++i];
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(field);
      field = "";
    } else field += ch;
  }
  out.push(field);
  return out;
}

export function parseSdnCsv(csv: string): SdnAddress[] {
  const found = new Map<string, SdnAddress>();
  for (const line of csv.split(/\r?\n/)) {
    if (!line.includes("Digital Currency Address")) continue;
    const cols = splitCsvLine(line);
    const name = cols[1]?.trim();
    const programs = cols[3]?.trim() ?? "";
    const remarks = cols[11] ?? "";
    for (const m of remarks.matchAll(/Digital Currency Address - ([A-Z0-9]+) ([A-Za-z0-9]+)/g)) {
      const [, code, raw] = m;
      for (const chain of CODE_CHAINS[code] ?? []) {
        const address = chain === "ETHEREUM" ? raw.toLowerCase() : raw;
        if (!ADDRESS_VALIDATORS[chain].test(address)) continue;
        found.set(`${chain}|${address}`, { address, chain, name, programs });
      }
    }
  }
  return [...found.values()];
}
