// Rule-based typology flags — SIH plan item 10. Fixed thresholds, not
// AI/ML pattern recognition; labeled as heuristics throughout the UI.
import type { TraceEdge, TraceNode, TypologyFlag } from "@/lib/tracers/types";

export const TYPOLOGY_LABEL: Record<TypologyFlag, string> = {
  FAN_OUT: "Fan-out / smurfing",
  PEEL_CHAIN: "Peel chain",
  RAPID_MIXER_HOP: "Rapid mixer hop",
};

// A lower threshold (the original value here was 3) mostly just detects
// "this node hit bfs.ts's FANOUT_CAP" (currently 5, a fixed perf/API-budget
// cap, not a real signal) — true of nearly any moderately active real
// wallet, not meaningful fan-out/smurfing. Confirmed live: a depth-3 trace
// off a busy real EOA flagged 5 of 16 nodes at the old threshold, and two of
// those had wildly mismatched destination values (near-zero-value contract
// calls, not smurfing-shaped at all) — just noise that happened to clear 3
// destinations. Raising this to 5 cut it to 3 of 16, all genuinely at the
// tracer's own observable ceiling. Deliberately a separate constant from
// FANOUT_CAP, not imported from it — same value today, but they answer
// different questions (this is "how much fan-out is suspicious," that one is
// "how much can the tracer afford to fetch") and coupling them would silently
// break if FANOUT_CAP is ever tuned down past 3, which would make the
// PEEL_CHAIN branch below unreachable.
const FAN_OUT_MIN_DESTINATIONS = 5;
// Larger leg must be at least this many times the smaller "peel" leg.
const PEEL_CHAIN_RATIO = BigInt(4);
// "Rapid" = reached a mixer without many laundering hops first — the tracer
// has no per-node dwell-time data (only outgoing tx history per hop), so
// this can't be a real time-based rapidity measure.
const RAPID_MIXER_MAX_DEPTH = 2;

function addFlag(target: { typologyFlags: TypologyFlag[] }, flag: TypologyFlag) {
  if (!target.typologyFlags.includes(flag)) target.typologyFlags.push(flag);
}

export function applyTypologyFlags(nodes: TraceNode[], edges: TraceEdge[]): void {
  const outgoingByAddress = new Map<string, TraceEdge[]>();
  for (const edge of edges) {
    const list = outgoingByAddress.get(edge.from) ?? [];
    list.push(edge);
    outgoingByAddress.set(edge.from, list);
  }

  for (const node of nodes) {
    const outgoing = outgoingByAddress.get(node.address) ?? [];

    if (outgoing.length >= FAN_OUT_MIN_DESTINATIONS) {
      addFlag(node, "FAN_OUT");
      for (const edge of outgoing) addFlag(edge, "FAN_OUT");
    } else if (outgoing.length === 2) {
      const [v1, v2] = outgoing.map((e) => BigInt(e.valueWei));
      const [big, small] = v1 >= v2 ? [v1, v2] : [v2, v1];
      if (small > BigInt(0) && big >= small * PEEL_CHAIN_RATIO) {
        addFlag(node, "PEEL_CHAIN");
        for (const edge of outgoing) addFlag(edge, "PEEL_CHAIN");
      }
    }

    if (node.kind === "MIXER" && node.depth <= RAPID_MIXER_MAX_DEPTH) {
      addFlag(node, "RAPID_MIXER_HOP");
      for (const edge of edges) {
        if (edge.to === node.address) addFlag(edge, "RAPID_MIXER_HOP");
      }
    }
  }
}
