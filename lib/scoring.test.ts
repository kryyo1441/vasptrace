// Run: npx tsx lib/scoring.test.ts
import assert from "node:assert";
import { aggregateReceivedByVasp, deriveRiskLevel, recommendVasp, unregisteredExchanges } from "./scoring";
import type { TraceEdge, TraceGraph, TraceNode } from "./tracers/types";

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

// An exchange with no registry entry isn't scored, but is surfaced — once per
// exchange, nearest address first — and a registered one is never listed.
{
  const bybit = [node("0xbybit2", 3, "Bybit Hot Wallet"), node("0xbybit1", 1, "Bybit 6"), node("0xbinance", 1, "Binance 14")];
  assert.deepEqual(unregisteredExchanges(bybit, registry), [{ entityName: "Bybit 6", address: "0xbybit1", depth: 1 }]);
  assert.deepEqual(unregisteredExchanges(nodes, registry), []);
}

// aggregateReceivedByVasp — "how much money has gone to each VASP", across
// stored cases, not one trace.
{
  const exchangeNode = (address: string, entityName: string): TraceNode => ({
    address,
    depth: 1,
    kind: "EXCHANGE",
    entityName,
    confidence: "high",
    stopReason: "LABEL_MATCH",
    typologyFlags: [],
  });
  const edge = (to: string, valueWei: string, asset?: TraceEdge["asset"]): TraceEdge => ({
    from: "suspect",
    to,
    valueWei,
    asset,
    kind: "TRANSFER",
    txCount: 1,
    latestTxHash: "0xh",
    latestTimestamp: 0,
    typologyFlags: [],
  });
  const usdt = { symbol: "USDT", decimals: 6, contract: "0xusdt" };

  const graphA: TraceGraph = {
    rootAddress: "suspect",
    chain: "ETHEREUM",
    maxDepth: 1,
    nodes: [exchangeNode("0xbin", "Binance 14")],
    edges: [edge("0xbin", "1000000000000000000"), edge("0xbin", "1000000", usdt)],
    warnings: [],
    recommendation: null,
  };
  const graphB: TraceGraph = {
    rootAddress: "suspect2",
    chain: "ETHEREUM",
    maxDepth: 1,
    nodes: [exchangeNode("0xbin2", "Binance 48")],
    edges: [edge("0xbin2", "500000000000000000")],
    warnings: [],
    recommendation: null,
  };

  const cases = [
    { chain: "ETHEREUM" as const, traceResult: JSON.stringify(graphA) },
    { chain: "ETHEREUM" as const, traceResult: JSON.stringify(graphB) },
  ];
  const totals = aggregateReceivedByVasp(cases);

  // Two Binance addresses across two cases collapse to one VASP, per asset.
  const eth = totals.find((t) => t.vaspName === "Binance" && t.symbol === "ETH")!;
  assert.equal(eth.totalBaseUnits, "1500000000000000000"); // 1 + 0.5 ETH
  assert.equal(eth.caseCount, 2);
  const usdtTotal = totals.find((t) => t.vaspName === "Binance" && t.symbol === "USDT")!;
  assert.equal(usdtTotal.totalBaseUnits, "1000000");
  assert.equal(usdtTotal.caseCount, 1);

  // A same-wallet (co-spend) match is excluded — not confirmed money to this VASP.
  const coSpendGraph: TraceGraph = {
    rootAddress: "s",
    chain: "BITCOIN",
    maxDepth: 1,
    nodes: [
      {
        address: "3addr",
        depth: 1,
        kind: "EXCHANGE",
        entityName: "Binance — same wallet",
        confidence: "medium",
        coSpend: { labeledAddress: "3known", labelType: "EXCHANGE", txHash: "tx" },
        stopReason: null,
        typologyFlags: [],
      },
    ],
    edges: [edge("3addr", "100000000")],
    warnings: [],
    recommendation: null,
  };
  assert.deepEqual(aggregateReceivedByVasp([{ chain: "BITCOIN", traceResult: JSON.stringify(coSpendGraph) }]), []);

  // Null/malformed traceResult is skipped, not a crash.
  assert.deepEqual(aggregateReceivedByVasp([{ chain: "ETHEREUM", traceResult: null }]), []);
  assert.deepEqual(aggregateReceivedByVasp([{ chain: "ETHEREUM", traceResult: "not json" }]), []);

  // A contract-call edge moved no value, so it must not contribute a "0.0000
  // ETH" total for a VASP that was only ever called, never paid — same
  // discipline as receivedInTrace's own zero-filter.
  const callOnlyGraph: TraceGraph = {
    rootAddress: "suspect3",
    chain: "ETHEREUM",
    maxDepth: 1,
    nodes: [exchangeNode("0xbin3", "Binance 20")],
    edges: [{ ...edge("0xbin3", "0"), kind: "CONTRACT_CALL" }],
    warnings: [],
    recommendation: null,
  };
  assert.deepEqual(aggregateReceivedByVasp([{ chain: "ETHEREUM", traceResult: JSON.stringify(callOnlyGraph) }]), []);
}

// deriveRiskLevel — case-level classification for the dashboard.
assert.equal(deriveRiskLevel([{ ...nodes[0], kind: "RANSOMWARE" }], []), "CRITICAL");
assert.equal(deriveRiskLevel([{ ...nodes[0], kind: "MIXER" }], []), "HIGH");
assert.equal(deriveRiskLevel(nodes, ["FAN_OUT", "PEEL_CHAIN"]), "HIGH");
assert.equal(deriveRiskLevel(nodes, ["FAN_OUT"]), "MEDIUM");
assert.equal(deriveRiskLevel(nodes, []), "LOW");

console.log("scoring self-check passed");
