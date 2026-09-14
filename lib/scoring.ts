// Legal-actionability scoring — SIH plan item 3, the project's key
// differentiator: the nearest-hop VASP isn't always the right one to route a
// disclosure request to if it's offshore, unregistered, or unresponsive.
// score = FIU-IND registration + India nodal officer + reliability - hops.
import { CHAIN_UNIT, isContractCall } from "@/lib/format";
import type { Chain, IssuerRegistry, RiskLevel, VaspRegistry } from "@/lib/generated/prisma/client";
import type { IssuerLead, TraceEdge, TraceGraph, TraceNode, TypologyFlag, VaspRecommendation, VaspScoreBreakdown } from "@/lib/tracers/types";

const FIUIND_WEIGHT = 3;
const NODAL_OFFICER_WEIGHT = 2;
const HOP_PENALTY = 1;

// Two bases can route a disclosure request:
// - an exact label match (high confidence), and
// - a same-wallet inference: Bitcoin common-input ownership with a labeled
//   exchange address (node.coSpend). Routable by user decision 2026-09-14,
//   on the condition that the payload and draft say it's an inference and
//   ask the VASP to confirm ownership before disclosing anything
//   (app/api/cases/[id]/sahyog/route.ts, components/sahyog-button.tsx).
// Every other medium/low guess (the forwards-80% rule, fan-in hubs) is for
// investigator attention only and never routes.

// LabeledAddress.entityName is free text like "Binance 14" / "Coinbase 1" /
// "Binance (cold wallet)"; VaspRegistry keys on the bare name, so match on
// the first word.
function registryNameFor(entityName: string): string {
  return entityName.split(/[\s(]/)[0];
}

function scoreVasp(depth: number, vasp: VaspRegistry): VaspScoreBreakdown {
  const score =
    (vasp.fiuindRegistered ? FIUIND_WEIGHT : 0) +
    (vasp.hasIndiaNodalOfficer ? NODAL_OFFICER_WEIGHT : 0) +
    vasp.responseReliabilityScore -
    depth * HOP_PENALTY;
  return {
    hopDistance: depth,
    fiuindRegistered: vasp.fiuindRegistered,
    hasIndiaNodalOfficer: vasp.hasIndiaNodalOfficer,
    responseReliabilityScore: vasp.responseReliabilityScore,
    score,
  };
}

export function recommendVasp(
  nodes: TraceNode[],
  vaspRegistry: VaspRegistry[]
): { top: VaspRecommendation; alternatives: VaspRecommendation[] } | null {
  const registryByName = new Map(vaspRegistry.map((v) => [v.name, v]));

  const candidates: VaspRecommendation[] = [];
  for (const node of nodes) {
    if (node.kind !== "EXCHANGE" || node.confidence !== "high" || !node.entityName) continue;
    const vasp = registryByName.get(registryNameFor(node.entityName));
    if (!vasp) continue;
    candidates.push({
      address: node.address,
      entityName: node.entityName,
      vaspName: vasp.name,
      breakdown: scoreVasp(node.depth, vasp),
    });
  }

  for (const node of nodes) {
    if (node.coSpend?.labelType !== "EXCHANGE" || !node.entityName) continue;
    const vasp = registryByName.get(registryNameFor(node.entityName));
    if (!vasp) continue;
    candidates.push({
      address: node.address,
      entityName: node.entityName,
      vaspName: vasp.name,
      breakdown: scoreVasp(node.depth, vasp),
      sameWallet: { labeledAddress: node.coSpend.labeledAddress, txHash: node.coSpend.txHash },
    });
  }

  if (candidates.length === 0) return null;

  // Highest score first; at equal score a confirmed label beats an inference,
  // then the nearer hop wins.
  candidates.sort(
    (a, b) =>
      b.breakdown.score - a.breakdown.score ||
      Number(!!a.sameWallet) - Number(!!b.sameWallet) ||
      a.breakdown.hopDistance - b.breakdown.hopDistance
  );
  // One entry per VASP: a request goes to an exchange, not an address, and
  // five addresses in one Binance wallet would otherwise list Binance five
  // times ("Binance over Binance").
  const seen = new Set<string>();
  const ranked = candidates.filter((c) => {
    if (seen.has(c.vaspName)) return false;
    seen.add(c.vaspName);
    return true;
  });
  return { top: ranked[0], alternatives: ranked.slice(1) };
}

// recommendVasp silently skips an exchange with no registry entry — right for
// scoring (there's nothing to score), wrong for the investigator, who should
// still learn that e.g. a Bybit wallet was reached. Same two bases as above,
// one entry per exchange name, nearest first.
export function unregisteredExchanges(
  nodes: TraceNode[],
  vaspRegistry: VaspRegistry[]
): { entityName: string; address: string; depth: number }[] {
  const registered = new Set(vaspRegistry.map((v) => v.name));
  const seen = new Set<string>();
  return nodes
    .filter((n) => ((n.kind === "EXCHANGE" && n.confidence === "high") || n.coSpend?.labelType === "EXCHANGE") && n.entityName)
    .filter((n) => !registered.has(registryNameFor(n.entityName!)))
    .sort((a, b) => a.depth - b.depth)
    .filter((n) => {
      const name = registryNameFor(n.entityName!);
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .map((n) => ({ entityName: n.entityName!, address: n.address, depth: n.depth }));
}

// Issuer freeze paths (ROADMAP item 3): every stablecoin actually seen on an
// edge, regardless of where the trace ended — the issuer can freeze at the
// asset layer independent of which exchange (if any) the funds reached, so
// this surfaces alongside recommendVasp's exchange-side answer, not instead
// of it. No score: IssuerRegistry carries facts, not an arithmetic weight
// (see its schema comment) — this is a lookup, not a ranking.
export function issuerLeads(edges: TraceEdge[], issuerRegistry: IssuerRegistry[]): IssuerLead[] {
  const bySymbol = new Map(issuerRegistry.map((i) => [i.symbol, i]));
  const seen = new Set<string>();
  const leads: IssuerLead[] = [];
  for (const edge of edges) {
    const symbol = edge.asset?.symbol;
    if (!symbol || seen.has(symbol)) continue;
    const issuer = bySymbol.get(symbol);
    if (!issuer) continue;
    seen.add(symbol);
    leads.push({
      assetSymbol: symbol,
      issuerName: issuer.issuerName,
      freezeProcess: issuer.freezeProcess,
      requiresCourtOrder: issuer.requiresCourtOrder,
      sourceUrl: issuer.sourceUrl,
    });
  }
  return leads;
}

export interface VaspInflowTotal {
  vaspName: string;
  symbol: string;
  totalBaseUnits: string;
  caseCount: number;
}

// "How much money has gone to each VASP" across every stored case — a
// dashboard-level aggregate, not a per-trace figure. Sums the value of every
// edge whose destination is an exact-label EXCHANGE node in that case's own
// stored graph, grouped by (VASP name, asset symbol) — never blended across
// symbols into one number, since there's no live price feed here to convert
// ETH+USDT+BTC into one honest total (the same "don't invent a figure the
// data can't support" rule as IssuerRegistry staying unscored, above).
// Same-wallet (co-spend) matches are deliberately excluded: they're an
// inference, not confirmed money-to-this-VASP.
//
// ponytail: parses every case's full traceResult JSON — a second O(all
// cases) pass alongside app/cases/page.tsx's existing typologyFlags tally,
// which only parses the smaller typologyFlags column. Fine at demo volume
// (under 100 rows); if this ever needs to scale, denormalize into a
// per-case summary column computed once at trace time instead of re-parsing
// the whole blob on every dashboard load.
export function aggregateReceivedByVasp(cases: { chain: Chain; traceResult: string | null }[]): VaspInflowTotal[] {
  const totals = new Map<string, { vaspName: string; symbol: string; total: bigint; cases: Set<number> }>();

  cases.forEach((c, i) => {
    if (!c.traceResult) return;
    let graph: TraceGraph;
    try {
      graph = JSON.parse(c.traceResult);
    } catch {
      return; // malformed/legacy blob — skip rather than crash the dashboard
    }
    const vaspByAddress = new Map(
      graph.nodes
        .filter((n) => n.kind === "EXCHANGE" && n.confidence === "high" && n.stopReason === "LABEL_MATCH" && n.entityName)
        .map((n) => [n.address, registryNameFor(n.entityName!)])
    );
    for (const edge of graph.edges) {
      // A contract call moved no value — same reason it never renders as a
      // payment on the graph or the PDF (ROADMAP.md item 0). Summing its
      // zero into a VASP's total would print "0.0000 ETH" for a VASP that
      // was only ever *called*, never paid, which is exactly the "zero read
      // as an observation" mistake receivedInTrace (lib/tracers/bfs.ts) had
      // to be fixed for too.
      if (isContractCall(edge)) continue;
      const vaspName = vaspByAddress.get(edge.to);
      if (!vaspName) continue;
      const symbol = edge.asset?.symbol ?? CHAIN_UNIT[c.chain].symbol;
      const key = `${vaspName}|${symbol}`;
      const cur = totals.get(key) ?? { vaspName, symbol, total: BigInt(0), cases: new Set<number>() };
      cur.total += BigInt(edge.valueWei);
      cur.cases.add(i);
      totals.set(key, cur);
    }
  });

  return [...totals.values()]
    // A total of exactly zero isn't worth showing regardless of how it got
    // there — a genuine CONTRACT_CALL edge is already excluded above, but a
    // case stored before that distinction existed (kind-less, read as
    // TRANSFER by the back-compat rule) can still carry a literal "0" value.
    // Either way, "0.0000 ETH" reads as an observation and isn't one.
    .filter((t) => t.total > BigInt(0))
    .map((t) => ({ vaspName: t.vaspName, symbol: t.symbol, totalBaseUnits: t.total.toString(), caseCount: t.cases.size }))
    .sort((a, b) => a.vaspName.localeCompare(b.vaspName) || a.symbol.localeCompare(b.symbol));
}

// Case-level risk classification (SIH plan item 7's dashboard needs a
// RiskLevel per case) — rule-based on the same signals typology/labeling
// already computed, not a separate model.
export function deriveRiskLevel(nodes: TraceNode[], typologyFlags: TypologyFlag[]): RiskLevel {
  if (nodes.some((n) => n.kind === "DARKNET" || n.kind === "RANSOMWARE" || n.kind === "SANCTIONED")) return "CRITICAL";
  if (nodes.some((n) => n.kind === "MIXER") || typologyFlags.length >= 2) return "HIGH";
  if (typologyFlags.length >= 1) return "MEDIUM";
  return "LOW";
}
