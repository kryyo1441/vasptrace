import type { TraceEdge, TraceGraph, VaspRecommendation } from "@/lib/tracers/types";
import type { Chain, RiskLevel } from "@/lib/generated/prisma/client";

export const CHAIN_LABEL: Record<Chain, string> = { ETHEREUM: "Ethereum", BITCOIN: "Bitcoin", TRON: "Tron" };

// Shared with app/api/cases/[id]/sahyog/route.ts's simulated payload — kept
// in one place so the disclosure email draft (components/sahyog-button.tsx)
// can't drift from what the "real" routed payload actually cites.
export const LEGAL_BASIS = "Section 91, Code of Criminal Procedure (India)";

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
  }/5 · score ${b.score}`;
}

// TraceEdge.valueWei is the smallest base unit for whichever chain the
// trace ran on (wei / satoshis / sun) — divisor+symbol keyed off it here
// rather than renaming the field across every file that touches it.
const CHAIN_UNIT: Record<Chain, { symbol: string; decimals: number }> = {
  ETHEREUM: { symbol: "ETH", decimals: 18 },
  BITCOIN: { symbol: "BTC", decimals: 8 },
  TRON: { symbol: "TRX", decimals: 6 },
};

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
function formatValue(baseUnits: string, chain: Chain) {
  const { symbol, decimals } = CHAIN_UNIT[chain];
  const value = BigInt(baseUnits);
  const perUnit = BigInt(10) ** BigInt(decimals);
  const steps = BigInt(10) ** BigInt(DISPLAY_DP);
  const scaled = (value * steps) / perUnit; // value in 1e-4 units, exact
  if (value > BigInt(0) && scaled === BigInt(0)) return `< 0.0001 ${symbol}`;
  return `${(Number(scaled) / Number(steps)).toFixed(DISPLAY_DP)} ${symbol}`;
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
export function edgeAmountLabel(edge: Pick<TraceEdge, "kind" | "valueWei" | "txCount">, chain: Chain) {
  const calls = `${edge.txCount} contract call${edge.txCount === 1 ? "" : "s"} · no value moved`;
  return isContractCall(edge) ? calls : `${formatValue(edge.valueWei, chain)} · ${edge.txCount} tx`;
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
