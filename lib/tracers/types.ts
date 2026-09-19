import type { Chain } from "@/lib/generated/prisma/client";

export type NodeKind =
  | "SUSPECT"
  | "INTERMEDIARY"
  | "EXCHANGE"
  | "MIXER"
  | "DARKNET"
  | "RANSOMWARE"
  | "BRIDGE"
  | "UNKNOWN"
  // OFAC SDN-listed, from the live sync (lib/sanctions.ts, ROADMAP item 5) —
  // distinct from RANSOMWARE/DARKNET since a sanctioned address isn't
  // necessarily either of those categories.
  | "SANCTIONED"
  // Terror-financing designation (Israel NBCTF seizure order, or OFAC SDGT) —
  // lib/terror.ts. Split from SANCTIONED so the reason for CRITICAL is on the
  // node itself. Added 2026-09-18.
  | "TERROR_FINANCING";

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
  // Set when the medium tier came from Bitcoin common-input ownership: this
  // address was spent as an input together with `labeledAddress` in `txHash`.
  // Absent on every other node and on cases stored before 2026-09-14.
  coSpend?: { labeledAddress: string; labelType: string; txHash: string };
  // Transitive common-input ownership: co-spent with `address` (a node that
  // is itself attributed) in `txHash`. Medium, never routes. Since 2026-09-14.
  coSpendVia?: { address: string; txHash: string };
  stopReason: StopReason;
  typologyFlags: TypologyFlag[];
  // Sum of this node's *incoming* edges within this trace, grouped by asset —
  // not the wallet's real total received, only what this trace's BFS
  // actually followed into it (capped by FANOUT_CAP/NODE_BUDGET/maxDepth
  // like everything else in the graph). Absent when nothing pointed at this
  // node in this trace (true of every root — the tracer only follows
  // outgoing edges, so a suspect's own incoming is never observed). Absent
  // on cases stored before 2026-09-15.
  receivedInTrace?: AssetTotal[];
  // Real, live on-chain figures — one extra paced API call per node, so only
  // fetched for the root and any LABEL_MATCH node (see lib/tracers/bfs.ts),
  // not every intermediary. Both are native-currency only (ETH/BTC/TRX, not
  // a token balance) and best-effort: a failed stats call leaves both unset
  // rather than failing the trace. `totalReceivedBaseUnits` is Bitcoin-only —
  // Blockstream's own indexed history makes it a real complete figure;
  // Ethereum/Tron only expose *current* balance, not lifetime inflow, so
  // claiming a "total received" there would overstate what was actually
  // observed (see lib/etherscan.ts / lib/tronscan.ts's getNativeBalance /
  // getAccountBalance for the honesty note). Absent on cases stored before
  // 2026-09-15.
  balanceBaseUnits?: string;
  totalReceivedBaseUnits?: string;
}

// What an edge actually represents. The tracers read *transactions*, and a
// transaction that moves no value is an interaction, not a payment — a
// zero-value contract call renders identically to a transfer unless the two
// are told apart. Real case that forced this: the headline demo address
// 0x6eedf92f… reaches WazirX only via 92 zero-value calls into WazirX's
// Gnosis Safe multisig during the July-2024 hack window, which the graph
// used to label "0.0000 ETH · 92 tx". See ROADMAP.md item 0.
export type TraceEdgeKind = "TRANSFER" | "CONTRACT_CALL";

// The token an edge moved, when it isn't the chain's native currency. Only
// allowlisted stablecoin contracts produce one (lib/etherscan.ts,
// lib/tronscan.ts), and symbol/decimals come from that allowlist, never from
// the API — spam tokens copy real symbols. See ROADMAP.md item 1.
export interface TraceAsset {
  symbol: string;
  decimals: number;
  contract: string;
}

// One asset's total across a set of edges — absent `asset` = native currency.
// Used both for "how much did this node receive within this trace" (summed
// from the trace's own edges, zero extra API calls) and for cross-case
// aggregation (lib/scoring.ts's aggregateReceivedByVasp). Never mixes assets
// in one total: 6-decimal USDT and 18-decimal ETH can't be added.
export interface AssetTotal {
  asset?: TraceAsset;
  valueBaseUnits: string;
}

export interface TraceEdge {
  from: string;
  to: string;
  // Smallest base unit as a decimal string — of `asset` when set, otherwise
  // of the chain's native currency: wei (Ethereum), satoshis (Bitcoin), or
  // sun (Tron), interpreted against `TraceGraph.chain`.
  valueWei: string;
  // Absent = native currency. Case.traceResult rows written before token
  // tracing (2026-09-13) never have one and must keep reading as native, so
  // test `edge.asset` for presence, never compare it against a native value.
  // Edges are aggregated per destination *and* asset: 6-decimal USDT can't
  // be summed with 18-decimal ETH.
  asset?: TraceAsset;
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
  // Set when this VASP was reached by same-wallet inference (common-input
  // ownership) rather than an exact label: the known VASP address the
  // attributed address co-spent with, and the tx proving it. The Sahyog
  // payload and draft then ask the VASP to confirm ownership first. Absent =
  // exact label match, including every case stored before 2026-09-14.
  sameWallet?: { labeledAddress: string; txHash: string };
  // The exchange's *deposit* address the funds were credited to, when the
  // trace shows one (added 2026-09-18). An exchange keys customer KYC on the
  // deposit address, not on the hot wallet it sweeps into, so this is the
  // selector the request should cite. Inferred (the forwards-≥80% rule in
  // lib/clustering.ts) — it never drives the recommendation itself, which
  // stays on the exact label above; it is a cited lead only. May equal the
  // suspect address (depth 0) when the suspect wallet itself behaves like a
  // deposit address. Absent when no such node sits in front of the exchange.
  depositAddress?: { address: string; depth: number; reason: string };
  // How an Indian LEA actually reaches this VASP (added 2026-09-18) — the
  // registry's jurisdiction and published law-enforcement channel. Facts, not
  // scored. `crossBorder` = not FIU-IND registered, so there is no domestic
  // obligation to answer. Absent on cases stored before 2026-09-18.
  channel?: { jurisdiction: string; leChannel: string; leChannelUrl: string; crossBorder: boolean };
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
  // Exchanges the trace reached (exact label or same-wallet) whose name has
  // no VaspRegistry entry, so they can't be scored or routed. Surfaced rather
  // than silently dropped. Absent on cases stored before 2026-09-14.
  unregisteredExchanges?: { entityName: string; address: string; depth: number }[];
  // Stablecoin issuers whose asset appeared somewhere in the trace, with
  // their known freeze process — a fact, not a score. See lib/scoring.ts's
  // issuerLeads. Absent on cases stored before 2026-09-14.
  issuerLeads?: IssuerLead[];
}

export interface IssuerLead {
  assetSymbol: string;
  issuerName: string;
  freezeProcess: string;
  requiresCourtOrder: boolean;
  sourceUrl: string;
}
