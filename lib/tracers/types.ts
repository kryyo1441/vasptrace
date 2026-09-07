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
  // "high" = exact address match against the labeled-address DB. Clustering
  // and pattern-based confidence tiers (medium/low, per the scoring spec)
  // aren't implemented by this tracer yet — every label here is exact-match.
  confidence: "high" | null;
  stopReason: StopReason;
  typologyFlags: TypologyFlag[];
}

export interface TraceEdge {
  from: string;
  to: string;
  valueWei: string;
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
  chain: "ETHEREUM";
  maxDepth: number;
  nodes: TraceNode[];
  edges: TraceEdge[];
  warnings: string[];
  // Best VASP to route a disclosure request to, ranked above raw hop
  // distance. null when the trace hit no labeled exchange.
  recommendation: { top: VaspRecommendation; alternatives: VaspRecommendation[] } | null;
}
