// Run: npx tsx lib/scoring.test.ts
import assert from "node:assert";
import { deriveRiskLevel, recommendVasp } from "./scoring";
import type { TraceNode } from "./tracers/types";

const node = (address: string, depth: number, entityName: string): TraceNode => ({
  address,
  depth,
  kind: "EXCHANGE",
  entityName,
  confidence: "high",
  stopReason: "LABEL_MATCH",
  typologyFlags: [],
});

// Mirrors the plan's own example: CoinDCX 2 hops away should beat Binance 1
// hop away because it's FIU-IND registered with an India nodal officer and
// higher reliability.
const nodes = [node("0xcoindcx", 2, "CoinDCX Hot 3"), node("0xbinance", 1, "Binance 14")];
const registry = [
  { id: "1", name: "CoinDCX", fiuindRegistered: true, hasIndiaNodalOfficer: true, responseReliabilityScore: 5 },
  { id: "2", name: "Binance", fiuindRegistered: true, hasIndiaNodalOfficer: false, responseReliabilityScore: 2 },
];

const result = recommendVasp(nodes, registry);
assert(result, "expected a recommendation");
assert.equal(result.top.vaspName, "CoinDCX", "closer-but-less-actionable VASP should not win");
assert.equal(result.alternatives[0].vaspName, "Binance");
assert(result.top.breakdown.score > result.alternatives[0].breakdown.score);

// No labeled exchange in the trace -> no recommendation.
assert.equal(recommendVasp([{ ...nodes[0], kind: "INTERMEDIARY" }], registry), null);

// Unregistered VASP name (not in registry) is skipped, not crashed on.
assert.equal(recommendVasp([node("0xunknown", 1, "SomeRandomExchange 1")], registry), null);

// A medium/low-confidence guess without co-spend evidence (e.g. the
// forwards-80% rule) must never enter the recommendation, even if labeled
// EXCHANGE.
assert.equal(
  recommendVasp([{ ...node("0xguess", 1, "Binance 14"), confidence: "medium" }], registry),
  null
);

// Same-wallet inference (common-input ownership) routes too, carrying its
// evidence so the request can ask the VASP to confirm ownership first.
{
  const coSpendNode = (address: string, depth: number, labelType = "EXCHANGE"): TraceNode => ({
    address,
    depth,
    kind: depth === 0 ? "SUSPECT" : "INTERMEDIARY",
    entityName: "Binance (cold wallet) — same wallet",
    confidence: "medium",
    coSpend: { labeledAddress: "3binance", labelType, txHash: `tx-${address}` },
    stopReason: null,
    typologyFlags: [],
  });
  const cluster = [coSpendNode("3hop2", 2), coSpendNode("3root", 0)];
  const rec = recommendVasp(cluster, registry);
  assert(rec, "a same-wallet exchange inference routes");
  assert.equal(rec.top.address, "3root");
  assert.equal(rec.alternatives.length, 0, "one entry per VASP, not one per address in the wallet");
  assert.equal(rec.top.breakdown.score, 3 + 0 + 2 - 0); // FIU-IND + no nodal officer + reliability 2 - 0 hops
  assert.deepEqual(rec.top.sameWallet, { labeledAddress: "3binance", txHash: "tx-3root" });
  assert.equal(recommendVasp([coSpendNode("3mixer", 1, "MIXER")], registry), null, "a mixer co-spend isn't a VASP");

  // Equal score, same VASP: the confirmed label wins over the inference.
  const tie = recommendVasp([coSpendNode("3inferred", 1), node("0xbinance", 1, "Binance 14")], registry)!;
  assert.equal(tie.top.address, "0xbinance");
  assert.equal(tie.top.sameWallet, undefined);

  // Exact-only traces are untouched: no basis marker, both VASPs listed.
  const exact = recommendVasp(nodes, registry)!;
  assert.equal(exact.top.sameWallet, undefined);
  assert.equal(exact.alternatives.length, 1);

  // Two exact labels of one VASP collapse to its best (nearest) address —
  // deliberate since 2026-09-14: a request goes to Binance once, not twice.
  const twoBinance = recommendVasp([node("0xbinance48", 3, "Binance 48"), node("0xbinance14", 1, "Binance 14")], registry)!;
  assert.equal(twoBinance.top.address, "0xbinance14");
  assert.equal(twoBinance.alternatives.length, 0);
}

// deriveRiskLevel — case-level classification for the dashboard.
assert.equal(deriveRiskLevel([{ ...nodes[0], kind: "RANSOMWARE" }], []), "CRITICAL");
assert.equal(deriveRiskLevel([{ ...nodes[0], kind: "MIXER" }], []), "HIGH");
assert.equal(deriveRiskLevel(nodes, ["FAN_OUT", "PEEL_CHAIN"]), "HIGH");
assert.equal(deriveRiskLevel(nodes, ["FAN_OUT"]), "MEDIUM");
assert.equal(deriveRiskLevel(nodes, []), "LOW");

console.log("scoring self-check passed");
