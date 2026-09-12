import type { Chain } from "@/lib/generated/prisma/client";

export type NodeKind =
  | "SUSPECT"
  | "INTERMEDIARY"
  | "EXCHANGE"
  | "MIXER"
  | "DARKNET"
  | "RANSOMWARE"
  | "BRIDGE"
  | "UNKNOWN";

export type StopReason = "LABEL_MATCH" | "MAX_DEPTH" | "API_ERROR" | null;

// Rule-based typology flags (SIH plan item 10) — heuristics, not AI/ML. See
// lib/typology.ts for the detection logic.
export type TypologyFlag = "FAN_OUT" | "PEEL_CHAIN" | "RAPID_MIXER_HOP";

export interface TraceNode {
  address: string;
  depth: number;
  kind: NodeKind;
  entityName?: string;
  source?: string;
  // "high" = exact address match (LabeledAddress DB). "medium" = clustering
  // heuristic (e.g. forwards most value to a known exchange). "low" =
  // pattern-based guess (e.g. fan-in consolidation hub). See lib/clustering.ts.
  confidence: "high" | "medium" | "low" | null;
  // Human-readable basis for a medium/low confidence label — how a labeled
  // address arrives at exact-match "high" is self-evident, so this is only
  // populated for the inferred tiers.
  confidenceReason?: string;
  stopReason: StopReason;
  typologyFlags: TypologyFlag[];
}

// What an edge actually represents. The tracers read *transactions*, and a
// transaction that moves no value is an interaction, not a payment — a
// zero-value contract call renders identically to a transfer unless the two
// are told apart. Real case that forced this: the headline demo address
// 0x6eedf92f… reaches WazirX only via 92 zero-value calls into WazirX's
// Gnosis Safe multisig during the July-2024 hack window, which the graph
// used to label "0.0000 ETH · 92 tx". See ROADMAP.md item 0.
export type TraceEdgeKind = "TRANSFER" | "CONTRACT_CALL";

export interface TraceEdge {
  from: string;
  to: string;
  // Smallest base unit as a decimal string — wei (Ethereum), satoshis
  // (Bitcoin), or sun (Tron). Interpret against `TraceGraph.chain`.
  valueWei: string;
  // Absent on Case.traceResult rows written before 2026-09-12 — read it as
  // `=== "CONTRACT_CALL"`, never `!== "TRANSFER"`, so old traces keep
  // rendering as transfers exactly as they did when they were generated.
  kind: TraceEdgeKind;
  txCount: number;
  latestTxHash: string;
  latestTimestamp: number;
  typologyFlags: TypologyFlag[];
}

// Legal-actionability scoring (SIH plan item 3) — see lib/scoring.ts.
export interface VaspScoreBreakdown {
  hopDistance: number;
  fiuindRegistered: boolean;
  hasIndiaNodalOfficer: boolean;
  responseReliabilityScore: number;
  score: number;
}

export interface VaspRecommendation {
  address: string;
  entityName: string;
  vaspName: string;
  breakdown: VaspScoreBreakdown;
}

export interface TraceGraph {
  rootAddress: string;
  chain: Chain;
  maxDepth: number;
  nodes: TraceNode[];
  edges: TraceEdge[];
  warnings: string[];
  // Best VASP to route a disclosure request to, ranked above raw hop
  // distance. null when the trace hit no labeled exchange.
  recommendation: { top: VaspRecommendation; alternatives: VaspRecommendation[] } | null;
}
