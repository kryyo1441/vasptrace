import type { AssetTotal, TraceAsset, TraceEdge, TraceGraph, VaspRecommendation } from "@/lib/tracers/types";
import type { Chain, RiskLevel } from "@/lib/generated/prisma/client";

export const CHAIN_LABEL: Record<Chain, string> = {
  ETHEREUM: "Ethereum",
  POLYGON: "Polygon",
  ARBITRUM: "Arbitrum",
  BSC: "BNB Chain",
  BITCOIN: "Bitcoin",
  TRON: "Tron",
  SOLANA: "Solana",
};

// Shared with app/api/cases/[id]/sahyog/route.ts's simulated payload — kept
// in one place so the disclosure email draft (components/sahyog-button.tsx)
// can't drift from what the "real" routed payload actually cites.
// The CrPC was repealed on 2024-07-01; Section 94 of the Bharatiya Nagarik
// Suraksha Sanhita, 2023 is its "summons to produce document or other thing"
// successor to CrPC s.91 (and adds electronic records). Both are named so a
// reader on either code can place it. Still needs sign-off from someone with
// legal training before any real use.
export const LEGAL_BASIS = "Section 94, Bharatiya Nagarik Suraksha Sanhita, 2023 (formerly Section 91, CrPC)";

// Freeze requests (added 2026-09-18) — PS 26182 asks for "disclosure or
// freezing requests". BNSS s.106 is the successor to CrPC s.102 (police
// seizure of property connected with an offence — the provision Indian police
// have long used for bank-account freezes, per State of Maharashtra v. Tapas
// D. Neogy, 1999). Two limits are stated in the payload rather than left out:
// s.106(3) requires the seizure be reported forthwith to the jurisdictional
// Magistrate, and several High Courts have held s.106 does not itself
// authorise a debit-freeze — attaching proceeds of crime needs a Magistrate's
// order under s.107. Same caveat as LEGAL_BASIS: needs sign-off from someone
// with legal training before any real use.
export const FREEZE_LEGAL_BASIS =
  "Section 106, Bharatiya Nagarik Suraksha Sanhita, 2023 (formerly Section 102, CrPC) — seizure of property connected with an offence";
export const FREEZE_LEGAL_CAVEAT =
  "The seizure must be reported forthwith to the jurisdictional Magistrate (BNSS s.106(3)). Courts have held s.106 does not by itself authorise a debit-freeze; attachment of proceeds of crime requires a Magistrate's order under BNSS s.107.";

// Offshore VASPs owe an Indian LEA nothing domestically; a voluntary request
// on their own LE portal is the fast path, and a Letter of Request under BNSS
// s.112 (formerly CrPC s.166A), sent through the Ministry of Home Affairs, is
// the compelled one. Shown next to any non-FIU-IND recommendation.
export const CROSS_BORDER_NOTE =
  "Not FIU-IND registered — no domestic obligation to respond. Fast path: a voluntary request on the exchange's own law-enforcement portal. Compelled path: a Letter of Request under BNSS s.112 (formerly CrPC s.166A), routed through the Ministry of Home Affairs.";

export type RequestKind = "DISCLOSURE" | "FREEZE";

export function channelLine(rec: VaspRecommendation): string {
  if (!rec.channel) return "";
  return `${rec.channel.jurisdiction} · ${rec.channel.leChannel}`;
}

// Everything about the deposit address except the address itself, so the UI
// can set the address in monospace; the PDF uses depositAddressLine whole.
export function depositAddressNote(rec: VaspRecommendation): string {
  const d = rec.depositAddress;
  if (!d) return "";
  const where = d.depth === 0 ? "the suspect address itself" : `hop ${d.depth}`;
  return `(inferred, ${where}) — ${d.reason}. Ask ${rec.vaspName} for the account this deposit address is assigned to.`;
}

export function depositAddressLine(rec: VaspRecommendation): string {
  return rec.depositAddress ? `Deposit address ${rec.depositAddress.address} ${depositAddressNote(rec)}` : "";
}

// CSS custom properties (light/dark pair defined in app/globals.css) rather
// than raw hex — the flat brand hues here failed WCAG AA text contrast
// against the card background in one theme or the other (a fixed hex can't
// pass both a light and a dark background at once). Only for use in the web
// UI, inline style props resolve these against the current theme fine; PDF
// rendering (lib/pdf/report.tsx) can't consume CSS vars and keeps its own
// literal light-mode values in sync with globals.css's :root block.
export const RISK_COLOR: Record<RiskLevel, string> = {
  LOW: "var(--risk-low)",
  MEDIUM: "var(--risk-medium)",
  HIGH: "var(--risk-high)",
  CRITICAL: "var(--risk-critical)",
};

export function vaspLine(rec: VaspRecommendation) {
  const b = rec.breakdown;
  return `${rec.vaspName} — ${b.hopDistance} hop${b.hopDistance === 1 ? "" : "s"} · ${
    b.fiuindRegistered ? "FIU-IND registered" : "not FIU-IND registered"
  } · ${b.hasIndiaNodalOfficer ? "India nodal officer" : "no India nodal officer"} · reliability ${
    b.responseReliabilityScore
  }/5 · score ${b.score}${rec.sameWallet ? " · same-wallet inference — confirm ownership" : ""}`;
}

// recommendVasp has no minimum score: the best exchange reached is still the
// best one, and hiding it would hide the arithmetic. But a score ≤ 0 (e.g.
// Bitfinex 3 hops out: 0 + 0 + 1 − 3 = −2) means the formula expects no useful
// answer, and the page must say that rather than recommend it with a straight
// face. Shared by the web rec line and the PDF.
export function lowActionabilityNote(rec: VaspRecommendation) {
  return rec.breakdown.score <= 0
    ? `Low actionability: score ${rec.breakdown.score} ≤ 0 — this VASP is unlikely to answer; treat the request as a long shot and look for other leads.`
    : "";
}

// The checkable claim behind a same-wallet recommendation, shared by the web
// pages and the PDF so they cite identical evidence.
export function sameWalletEvidence(rec: VaspRecommendation) {
  if (!rec.sameWallet) return "";
  return `${rec.address} (hop ${rec.breakdown.hopDistance}) was spent as an input together with known ${rec.vaspName} address ${rec.sameWallet.labeledAddress} in tx ${rec.sameWallet.txHash}`;
}

// TraceEdge.valueWei is the smallest base unit of the edge's `asset` when it
// has one (USDT, USDC), else of the chain's native currency (wei / satoshis /
// sun) — divisor+symbol keyed off it here rather than renaming the field
// across every file that touches it.
// Exported: reused wherever a value needs formatting outside an edge context
// — a node's received-in-trace or balance totals (below), a chain's own
// native unit for a value that has no `asset`.
export const CHAIN_UNIT: Record<Chain, { symbol: string; decimals: number }> = {
  ETHEREUM: { symbol: "ETH", decimals: 18 },
  POLYGON: { symbol: "POL", decimals: 18 }, // formerly MATIC
  ARBITRUM: { symbol: "ETH", decimals: 18 }, // Arbitrum's native gas coin is ETH
  BSC: { symbol: "BNB", decimals: 18 },
  BITCOIN: { symbol: "BTC", decimals: 8 },
  TRON: { symbol: "TRX", decimals: 6 },
  SOLANA: { symbol: "SOL", decimals: 9 }, // lamports
};

// Decimals for a token symbol, independent of which chain it's on — every
// stablecoin this app allowlists is pinned to 6 decimals regardless of chain
// (lib/etherscan.ts's ERC20_ALLOWLIST, lib/tronscan.ts's TRC20_USDT), and a
// native symbol's decimals are fixed by CHAIN_UNIT above. Used only for
// cross-case aggregation (lib/scoring.ts's aggregateReceivedByVasp), where
// grouping is by symbol, not by one edge's own `asset` object.
const NATIVE_DECIMALS_BY_SYMBOL = new Map(Object.values(CHAIN_UNIT).map((u) => [u.symbol, u.decimals]));
function decimalsForSymbol(symbol: string): number {
  return NATIVE_DECIMALS_BY_SYMBOL.get(symbol) ?? 6; // every non-native symbol here is a 6-decimal stablecoin
}

const DISPLAY_DP = 4;

// Scaled down in BigInt, not by dividing a Number: `Number(BigInt(wei))`
// overflows 2^53 for any balance above ~0.009 ETH, and 4-dp rounding then
// happens on an already-lossy figure.
//
// The `< 0.0001` branch is the point of this function. Plain `.toFixed(4)`
// renders a 1-wei transfer as "0.0000 ETH" — the very string this session
// removed from contract-call edges — except on a real TRANSFER, where no
// dashed line or legend key exists to explain it. A dust amount and nothing
// must not read alike. Exactly zero still prints "0.0000" so the
// pre-2026-09-12 stored cases (no `kind`, so rendered as transfers) look
// exactly as they did when they were generated.
function formatValue(baseUnits: string, { symbol, decimals }: { symbol: string; decimals: number }) {
  const value = BigInt(baseUnits);
  const perUnit = BigInt(10) ** BigInt(decimals);
  const steps = BigInt(10) ** BigInt(DISPLAY_DP);
  const scaled = (value * steps) / perUnit; // value in 1e-4 units, exact
  if (value > BigInt(0) && scaled === BigInt(0)) return `< 0.0001 ${symbol}`;
  return `${(Number(scaled) / Number(steps)).toFixed(DISPLAY_DP)} ${symbol}`;
}

// Public wrapper over formatValue for callers that have an asset (or lack of
// one) directly, not an edge — a node's balance/received totals, below.
export function formatAssetValue(baseUnits: string, asset: TraceAsset | undefined, chain: Chain): string {
  return formatValue(baseUnits, asset ?? CHAIN_UNIT[chain]);
}

// Formats by symbol alone, for the one place an edge/asset object isn't
// available: cross-case aggregation, where the grouping key is already just
// a symbol string. Not for per-trace display — use formatAssetValue there,
// which carries the edge's own asset (contract, exact decimals) rather than
// trusting a symbol-to-decimals guess.
export function formatBySymbol(baseUnits: string, symbol: string): string {
  return formatValue(baseUnits, { symbol, decimals: decimalsForSymbol(symbol) });
}

// Sums a list of same-shaped {asset, valueBaseUnits} items (edges, mostly)
// by asset — 6-decimal USDT and 18-decimal wei never share a total. Used for
// "how much did this node receive in this trace" (lib/tracers/bfs.ts) and
// could sum any other edge list the same way.
export function sumValuesByAsset(items: { asset?: TraceAsset; valueBaseUnits: string }[]): AssetTotal[] {
  const byKey = new Map<string, { asset?: TraceAsset; total: bigint }>();
  for (const item of items) {
    const key = item.asset?.contract ?? "";
    const cur = byKey.get(key) ?? { asset: item.asset, total: BigInt(0) };
    cur.total += BigInt(item.valueBaseUnits || "0");
    byKey.set(key, cur);
  }
  return [...byKey.values()].map((v) => ({ asset: v.asset, valueBaseUnits: v.total.toString() }));
}

// Joins multiple per-asset totals into one line, e.g. "23.7000 ETH +
// 3754.9000 USDT". Empty totals list (nothing pointed at this node in this
// trace) returns "" rather than a misleading "0 <native>" — silence is the
// honest answer when the trace observed no inflow, not a zero.
export function assetTotalsLabel(totals: AssetTotal[], chain: Chain): string {
  return totals.map((t) => formatAssetValue(t.valueBaseUnits, t.asset, chain)).join(" + ");
}

// Compared against "CONTRACT_CALL" rather than "!== TRANSFER" on purpose:
// Case.traceResult rows written before 2026-09-12 have no `kind` at all, and
// they should keep rendering as transfers exactly as they did then.
export function isContractCall(edge: Pick<TraceEdge, "kind">) {
  return edge.kind === "CONTRACT_CALL";
}

// A contract call moved no value, so a value is the one thing its label must
// not lead with — "0.0000 ETH" reads as "a payment of nothing" when the
// honest reading is "not a payment". See ROADMAP.md item 0.
export function edgeAmountLabel(edge: Pick<TraceEdge, "kind" | "valueWei" | "txCount" | "asset">, chain: Chain) {
  const calls = `${edge.txCount} contract call${edge.txCount === 1 ? "" : "s"} · no value moved`;
  return isContractCall(edge) ? calls : `${formatValue(edge.valueWei, edge.asset ?? CHAIN_UNIT[chain])} · ${edge.txCount} tx`;
}

const EVIDENCE_TRAIL_LIMIT = 10;

// Built here, not at the two call sites that used to each slice the edges
// themselves (app/api/cases/[id]/sahyog/route.ts and app/cases/[id]/page.tsx,
// whose comment already admitted it was mirroring the other). This trail is
// quoted verbatim into a disclosure request drafted under LEGAL_BASIS, so a
// contract-call hash must never sit in it unmarked: the draft asks the VASP
// about addresses that "received funds", and a zero-value call received
// none. Transfers lead, since those are the ones that carry the claim.
export function evidenceTrail(graph: TraceGraph | null): string[] {
  if (!graph) return [];
  const ordered = [
    ...graph.edges.filter((e) => !isContractCall(e)),
    ...graph.edges.filter(isContractCall),
  ];
  return ordered
    .slice(0, EVIDENCE_TRAIL_LIMIT)
    .map((e) =>
      isContractCall(e) ? `${e.latestTxHash} (contract call — no value moved)` : e.latestTxHash
    );
}

// True when nothing in the trace actually moved value — the disclosure draft
// must not then assert that funds were received.
export function hasValueTransfer(graph: TraceGraph | null): boolean {
  return !!graph && graph.edges.some((e) => !isContractCall(e));
}

// "N transfers" was on both /, /cases/[id] and the PDF, and it was simply
// untrue of a contract-call edge. One builder so the three can't disagree.
export function edgeCountLabel(graph: TraceGraph): string {
  const calls = graph.edges.filter(isContractCall).length;
  const transfers = graph.edges.length - calls;
  const parts = [`${transfers} transfer${transfers === 1 ? "" : "s"}`];
  if (calls > 0) parts.push(`${calls} contract-call link${calls === 1 ? "" : "s"} (no value)`);
  return parts.join(", ");
}

// Present when the recommended VASP was reached by same-wallet inference
// (common-input ownership), not an exact label: the request must say so and
// ask the VASP to confirm ownership before disclosing. See lib/scoring.ts.
export type Attribution = { address: string; labeledAddress: string; txHash: string };

// The disclosure email draft (components/sahyog-button.tsx). Lives here, not
// in the component, so lib/format.test.ts can assert the legal wording —
// the evidenceTrail bug of 2026-09-12 survived a first pass precisely because
// nothing could reach the draft.
export function buildEmailDraft({
  caseId,
  vaspName,
  address,
  chain,
  evidenceTrail,
  valueMoved,
  attribution,
  depositAddress,
  kind = "DISCLOSURE",
  amountsAtStake,
}: {
  caseId: string;
  vaspName: string;
  address: string;
  chain: Chain;
  evidenceTrail: string[];
  // Inferred deposit address in front of the VASP's labeled wallet — cited as
  // the account selector, always marked as an inference.
  depositAddress?: VaspRecommendation["depositAddress"];
  kind?: RequestKind;
  // Freeze only: what this trace saw credited to the VASP, already formatted.
  amountsAtStake?: string;
  // False when the trace found no value transfer at all — the headline demo
  // address is like this: 92 zero-value calls into WazirX's multisig and not
  // a wei moved. The draft then must not ask about "funds received", because
  // none were. See ROADMAP.md item 0.
  valueMoved: boolean;
  attribution?: Attribution;
}) {
  const noun = kind === "FREEZE" ? "Freeze" : "Disclosure";
  const subject = attribution
    ? `Ownership Confirmation and ${noun} Request — Case ${caseId} — ${vaspName}`
    : `${noun} Request — Case ${caseId} — ${vaspName}`;
  const depositBlock = depositAddress
    ? `\nDeposit address (inferred): ${depositAddress.address}
${depositAddress.depth === 0 ? "The suspect address itself" : `This address (hop ${depositAddress.depth})`} forwards most of its value to your
labeled wallet, so it appears to be a deposit address you assigned to a
customer. This is an inference, not a confirmed label — please identify the
account it is assigned to, or tell us it is not yours.\n`
    : "";
  const freezeBlock =
    kind === "FREEZE"
      ? `
Freeze requested:
Please place an immediate hold on the account(s) that received funds traced
from the suspect address, pending a Magistrate's order.${amountsAtStake ? `
Credited to your platform in this trace: ${amountsAtStake}.` : ""}
Legal basis: ${FREEZE_LEGAL_BASIS}.
${FREEZE_LEGAL_CAVEAT}
`
      : "";
  const body = `To: ${vaspName} Compliance / Legal Team

This is a ${noun.toLowerCase()} request in relation to a law-enforcement investigation
under ${(kind === "FREEZE" ? FREEZE_LEGAL_BASIS.split(" — ")[0] : LEGAL_BASIS).replace(" (formerly", "\n(formerly")}.

Suspect address: ${address}
Chain: ${CHAIN_LABEL[chain]}
Case reference: ${caseId}
${depositBlock}${freezeBlock}
${
    // Checked first: a same-wallet inference is Bitcoin-only, where every
    // edge is a value transfer, so the no-value branch below can't apply.
    attribution
      ? `Basis of attribution — please confirm ownership first:
Our analysis attributes ${attribution.address} to ${vaspName} by common-input
ownership, not by a confirmed label. That address was spent as an input in
transaction ${attribution.txHash} together with ${attribution.labeledAddress},
an address publicly attributed to ${vaspName}. This is an inference.

Please first confirm whether ${attribution.address} is controlled by
${vaspName}. If it is, we request account-holder KYC details and transaction
records associated with ${
          // At hop 0 the attributed address *is* the suspect address.
          attribution.address === address ? "it," : "it and with the suspect address above,"
        }
per the evidence trail below. If it is not, please tell us so the attribution
can be corrected; in that case no further disclosure is requested.`
      : valueMoved
        ? `We request account-holder KYC details and transaction records associated
with the above address, or any address that received funds traced from it,
per the evidence trail below.`
        : `The trace recorded no value transfers from this address. The evidence below
is on-chain contract interactions with your platform, not incoming funds. We
request account-holder KYC details and any records associated with these
interactions, and with the address above.`
  }

Evidence trail (transaction hashes):
${evidenceTrail.length > 0 ? evidenceTrail.map((h) => `- ${h}`).join("\n") : "(no evidence hashes recorded for this trace)"}

Please respond to this request at your earliest convenience.

— Generated by VASPtrace. This is a simulated ${noun.toLowerCase()}-request draft —
Sahyog API access is not yet publicly available. Review before sending
through your organization's own official channel.`;
  return { subject, body };
}
