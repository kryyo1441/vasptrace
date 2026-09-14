// Legal-actionability scoring — SIH plan item 3, the project's key
// differentiator: the nearest-hop VASP isn't always the right one to route a
// disclosure request to if it's offshore, unregistered, or unresponsive.
// score = FIU-IND registration + India nodal officer + reliability - hops.
import type { RiskLevel, VaspRegistry } from "@/lib/generated/prisma/client";
import type { TraceNode, TypologyFlag, VaspRecommendation, VaspScoreBreakdown } from "@/lib/tracers/types";

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

// Case-level risk classification (SIH plan item 7's dashboard needs a
// RiskLevel per case) — rule-based on the same signals typology/labeling
// already computed, not a separate model.
export function deriveRiskLevel(nodes: TraceNode[], typologyFlags: TypologyFlag[]): RiskLevel {
  if (nodes.some((n) => n.kind === "DARKNET" || n.kind === "RANSOMWARE")) return "CRITICAL";
  if (nodes.some((n) => n.kind === "MIXER") || typologyFlags.length >= 2) return "HIGH";
  if (typologyFlags.length >= 1) return "MEDIUM";
  return "LOW";
}
