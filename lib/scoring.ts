// Legal-actionability scoring — SIH plan item 3, the project's key
// differentiator: the nearest-hop VASP isn't always the right one to route a
// disclosure request to if it's offshore, unregistered, or unresponsive.
// score = FIU-IND registration + India nodal officer + reliability - hops.
import type { RiskLevel, VaspRegistry } from "@/lib/generated/prisma/client";
import type { TraceNode, TypologyFlag, VaspRecommendation, VaspScoreBreakdown } from "@/lib/tracers/types";

const FIUIND_WEIGHT = 3;
const NODAL_OFFICER_WEIGHT = 2;
const HOP_PENALTY = 1;

// ponytail: no separate confidence multiplier. Every node reaching this
// scorer is an exact LabeledAddress match — the only confidence tier the
// tracer currently produces (see types.ts) — so a multiplier would always
// be 1. Add one back once clustering-based medium/low labels exist.

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
    if (node.kind !== "EXCHANGE" || !node.entityName) continue;
    const vasp = registryByName.get(registryNameFor(node.entityName));
    if (!vasp) continue;
    candidates.push({
      address: node.address,
      entityName: node.entityName,
      vaspName: vasp.name,
      breakdown: scoreVasp(node.depth, vasp),
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.breakdown.score - a.breakdown.score);
  return { top: candidates[0], alternatives: candidates.slice(1) };
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
