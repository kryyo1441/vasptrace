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
}

export interface TraceEdge {
  from: string;
  to: string;
  valueWei: string;
  txCount: number;
  latestTxHash: string;
  latestTimestamp: number;
}

export interface TraceGraph {
  rootAddress: string;
  chain: "ETHEREUM";
  maxDepth: number;
  nodes: TraceNode[];
  edges: TraceEdge[];
  warnings: string[];
}
