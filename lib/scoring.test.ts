// Run: npx tsx lib/scoring.test.ts
import assert from "node:assert";
import { recommendVasp } from "./scoring";
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

console.log("scoring self-check passed");
