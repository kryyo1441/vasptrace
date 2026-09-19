// Live OFAC SDN sync (ROADMAP item 5) plus, since 2026-09-18, Israel NBCTF
// terror-financing seizure orders (lib/terror.ts). SUPERVISOR-only: this
// writes shared label data every investigator's traces read, not a per-user
// action. One feed failing doesn't stop the other — each reports its own
// result or error.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseSdnCsv, SDN_CSV_URL } from "@/lib/sanctions";
import { NBCTF_URL, parseNbctfJsonl, sanctionLabelType, syncDecision } from "@/lib/terror";
import type { Chain } from "@/lib/generated/prisma/client";

type Entry = { address: string; chain: Chain; labelType: "SANCTIONED" | "TERROR_FINANCING"; entityName: string; source: string };
type FeedResult = { created: number; updated: number; skippedCurated: number; total: number; terror: number } | { error: string };

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`feed returned ${res.status}`);
  return res.text();
}

async function apply(entries: Entry[]): Promise<Exclude<FeedResult, { error: string }>> {
  let created = 0;
  let updated = 0;
  let skippedCurated = 0;
  for (const entry of entries) {
    // Real bug caught live (2026-09-14): a blind upsert overwrote the
    // hand-verified SamSam address's RANSOMWARE label with the generic
    // SANCTIONED one, the moment OFAC's own feed happened to also list it.
    // syncDecision encodes that rule, and adds: never downgrade
    // TERROR_FINANCING to SANCTIONED.
    const existing = await prisma.labeledAddress.findUnique({
      where: { address_chain: { address: entry.address, chain: entry.chain } },
    });
    const decision = syncDecision(existing?.labelType, entry.labelType);
    if (decision === "skip") {
      skippedCurated++;
      continue;
    }
    await prisma.labeledAddress.upsert({
      where: { address_chain: { address: entry.address, chain: entry.chain } },
      update: entry,
      create: entry,
    });
    if (decision === "update") updated++;
    else created++;
  }
  return { created, updated, skippedCurated, total: entries.length, terror: entries.filter((e) => e.labelType === "TERROR_FINANCING").length };
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.role !== "SUPERVISOR") return NextResponse.json({ error: "Supervisor role required" }, { status: 403 });

  const today = new Date().toISOString().slice(0, 10);
  const [sdn, nbctf] = await Promise.allSettled([fetchText(SDN_CSV_URL), fetchText(NBCTF_URL)]);

  let ofac: FeedResult;
  if (sdn.status === "fulfilled") {
    ofac = await apply(
      parseSdnCsv(sdn.value).map((a) => ({
        address: a.address,
        chain: a.chain,
        labelType: sanctionLabelType(a.programs),
        entityName: a.name,
        source: `OFAC SDN List (${SDN_CSV_URL}), synced ${today}${a.programs ? ` — ${a.programs}` : ""}`,
      }))
    );
    await audit(user.id, "SANCTIONS_SYNC", null, ofac);
  } else {
    ofac = { error: `Could not fetch OFAC SDN feed: ${(sdn.reason as Error).message}` };
  }

  let israel: FeedResult;
  if (nbctf.status === "fulfilled") {
    israel = await apply(
      parseNbctfJsonl(nbctf.value).map((a) => ({
        address: a.address,
        chain: a.chain,
        labelType: "TERROR_FINANCING" as const,
        entityName: a.name,
        source: `Israel NBCTF administrative seizure order ${a.order} (via OpenSanctions il_mod_crypto, ${NBCTF_URL}), synced ${today}`,
      }))
    );
    await audit(user.id, "TERROR_SYNC", null, israel);
  } else {
    israel = { error: `Could not fetch NBCTF feed: ${(nbctf.reason as Error).message}` };
  }

  const bothFailed = "error" in ofac && "error" in israel;
  return NextResponse.json({ ofac, israel }, { status: bothFailed ? 502 : 200 });
}
