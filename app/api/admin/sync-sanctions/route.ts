// Live OFAC SDN sync (ROADMAP item 5). SUPERVISOR-only: this writes shared
// label data every investigator's traces read, not a per-user action.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseSdnCsv, SDN_CSV_URL } from "@/lib/sanctions";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.role !== "SUPERVISOR") return NextResponse.json({ error: "Supervisor role required" }, { status: 403 });

  let csv: string;
  try {
    const res = await fetch(SDN_CSV_URL, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`OFAC feed returned ${res.status}`);
    csv = await res.text();
  } catch (err) {
    return NextResponse.json({ error: `Could not fetch OFAC SDN feed: ${(err as Error).message}` }, { status: 502 });
  }

  const addresses = parseSdnCsv(csv);
  let created = 0;
  let updated = 0;
  let skippedCurated = 0;
  for (const a of addresses) {
    const entry = {
      address: a.address,
      chain: a.chain,
      labelType: "SANCTIONED" as const,
      entityName: a.name,
      source: `OFAC SDN List (${SDN_CSV_URL}), synced ${new Date().toISOString().slice(0, 10)}${a.programs ? ` — ${a.programs}` : ""}`,
    };
    // Real bug caught live (2026-09-14): a blind upsert overwrote the
    // hand-verified SamSam address's RANSOMWARE label with the generic
    // SANCTIONED one, the moment OFAC's own feed happened to also list it
    // (it does — SamSam is an SDN entry). A curated label is strictly more
    // specific than "on the sanctions list" and must never be downgraded by
    // an automated sync. So: create if absent, refresh only an existing
    // SANCTIONED row (re-sync), skip anything with any other labelType.
    const existing = await prisma.labeledAddress.findUnique({
      where: { address_chain: { address: entry.address, chain: entry.chain } },
    });
    if (existing && existing.labelType !== "SANCTIONED") {
      skippedCurated++;
      continue;
    }
    await prisma.labeledAddress.upsert({
      where: { address_chain: { address: entry.address, chain: entry.chain } },
      update: entry,
      create: entry,
    });
    if (existing) updated++;
    else created++;
  }

  await audit(user.id, "SANCTIONS_SYNC", null, { created, updated, skippedCurated, total: addresses.length });

  return NextResponse.json({ created, updated, skippedCurated, total: addresses.length });
}
