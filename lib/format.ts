import type { VaspRecommendation } from "@/lib/tracers/types";
import type { RiskLevel } from "@/lib/generated/prisma/client";

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
