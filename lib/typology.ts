// Rule-based typology flags — SIH plan item 10. Fixed thresholds, not
// AI/ML pattern recognition; labeled as heuristics throughout the UI.
import type { TraceEdge, TraceNode, TypologyFlag } from "@/lib/tracers/types";

export const TYPOLOGY_LABEL: Record<TypologyFlag, string> = {
  FAN_OUT: "Fan-out / smurfing",
  PEEL_CHAIN: "Peel chain",
  RAPID_MIXER_HOP: "Rapid mixer hop",
};

const FAN_OUT_MIN_DESTINATIONS = 3;
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
